# Deploying the Helpdesk to Azure: Runbook

This deploys the app to **Azure Container Apps** plus **PostgreSQL Flexible Server** in **one resource group**
(`helpdesk-rg`, region `centralindia`). You run every command yourself in **Azure Cloud Shell → Bash**. It takes about
45 minutes, mostly waiting. 💰 marks the approximate cost of each step; the full estimate is in [COSTS.md](COSTS.md).

> ⏰ **Tear everything down by Oct 10, 2026** (step 14). The subscription credits expire on Oct 12.

> **Status:** none of these commands has been run by the author. The templates pass `bicep build`/`bicep lint`
> and the workflow passes `actionlint`. Expect to adjust things if Azure reports region- or subscription-specific
> errors; see [Troubleshooting](#troubleshooting).

---

## ↻ Resume after a Cloud Shell disconnect
Cloud Shell here has **no persistent storage** and disconnects after about 20 minutes idle. That clears your
variables, the cloned repo and any installed CLI extensions. Paste this block whenever you (re)open Cloud Shell. It's safe to run at any
point, even before step 3.

```bash
PREFIX=helpdesk; RG=helpdesk-rg; GH_REPO=Sujayweb3master/ai-projects
# Use the region the resource group was created in (centralindia unless you switched, see Troubleshooting).
LOCATION=$(az group show -n $RG --query location -o tsv 2>/dev/null || echo centralindia)
SUB_ID=$(az account show --query id -o tsv); TENANT_ID=$(az account show --query tenantId -o tsv)
az extension add --name containerapp --upgrade --yes --only-show-errors   # extensions don't survive a restart
if [ -d ~/ai-projects ]; then git -C ~/ai-projects pull --ff-only --quiet
else git clone --quiet --depth 1 --branch feat/helpdesk-app https://github.com/$GH_REPO.git ~/ai-projects; fi
cd ~/ai-projects/helpdesk-app/infra
if az deployment group show -g $RG -n core -o none 2>/dev/null; then
  out() { az deployment group show -g $RG -n core --query "properties.outputs.$1.value" -o tsv; }
  KV_NAME=$(out keyVaultName); ACR_NAME=$(out acrName); PG_NAME=$(out postgresServerName); PG_FQDN=$(out postgresFqdn)
fi
APP_ID=$(az ad app list --display-name helpdesk-github-deploy --query "[0].appId" -o tsv 2>/dev/null)
WEB_FQDN=$(az containerapp show -g $RG -n helpdesk-web --query properties.configuration.ingress.fqdn -o tsv 2>/dev/null)
[ -n "$WEB_FQDN" ] && WEB=https://$WEB_FQDN
echo "LOCATION=$LOCATION KV=$KV_NAME ACR=$ACR_NAME PG=$PG_NAME APP_ID=$APP_ID WEB=$WEB"
```
Empty values just mean that step hasn't happened yet.

---

## 0. Pre-deploy checklist
- [ ] CI is green on `feat/helpdesk-app` (GitHub → Actions → helpdesk-ci).
- [ ] Cloud Shell is logged in to the subscription **with the credits** (step 1 prints it).
- [ ] You know which email address will be the first admin.
- [ ] You've read [Rollback](#12-rollback) and put **Oct 10: teardown** in your calendar.

## 1. Set variables (free)
```bash
PREFIX=helpdesk; LOCATION=centralindia; RG=helpdesk-rg; GH_REPO=Sujayweb3master/ai-projects
az account show --query "{subscription:name, id:id, user:user.name}" -o table   # confirm it's the right subscription
SUB_ID=$(az account show --query id -o tsv); TENANT_ID=$(az account show --query tenantId -o tsv)
az extension add --name containerapp --upgrade --yes --only-show-errors
```
The `containerapp` CLI extension is needed from step 10 onwards. If you skip the last line, the first `az containerapp …`
command will ask to install it; answer **Y**.

Optional: **check live prices** before spending anything. This is read-only:
```bash
curl -s "https://prices.azure.com/api/retail/prices?\$filter=armRegionName eq '$LOCATION' and serviceName eq 'Azure Database for PostgreSQL' and contains(skuName,'B1ms')" \
  | jq -r '.Items[] | select(.type=="Consumption") | "\(.meterName): \(.retailPrice) USD per \(.unitOfMeasure)"'
```

## 2. Get the templates (free)
```bash
git clone --depth 1 --branch feat/helpdesk-app https://github.com/$GH_REPO.git ~/ai-projects
cd ~/ai-projects/helpdesk-app/infra && ls   # apps.bicep  core.bicep  database.bicep  modules
```

## 3. Create the resource group (free)
```bash
az group create -n $RG -l $LOCATION --tags project=helpdesk -o table
```
This is the single container for everything, which is why deleting it in step 14 removes everything.

## 4. Deploy the core resources (about 2 min; 💰 ACR about $0.17/day, everything else about $0 while idle)
**4a. Preview first.** Nothing is created by this command:
```bash
ME=$(az ad signed-in-user show --query id -o tsv)
az deployment group what-if -g $RG -n core -f core.bicep -p prefix=$PREFIX deployerObjectId=$ME
```
✅ **A good result** ends with `Resource changes: 8 to create.` and lists only green `+` lines:
- 1 × `Microsoft.OperationalInsights/workspaces` (`helpdesk-logs`)
- 1 × `Microsoft.ManagedIdentity/userAssignedIdentities` (`helpdesk-id`)
- 1 × `Microsoft.ContainerRegistry/registries` (`helpdeskacr…`)
- 1 × `Microsoft.KeyVault/vaults` (`helpdesk-kv-…`)
- 3 × `Microsoft.Authorization/roleAssignments`
- 1 × `Microsoft.App/managedEnvironments` (`helpdesk-env`)

❌ **Stop** if you see any red `-` (delete) lines, or an error such as `InvalidTemplateDeployment`, `SkuNotAvailable`,
`LocationIsOfferRestricted` or `QuotaExceeded` (see [Troubleshooting](#troubleshooting)). For more detail on an error run
`az deployment group validate -g $RG -f core.bicep -p prefix=$PREFIX deployerObjectId=$ME`.
On a re-run, `= Nochange` / `~ Modify` lines are normal.

**4b. Deploy:**
```bash
az deployment group create -g $RG -n core -f core.bicep -p prefix=$PREFIX deployerObjectId=$ME -o none
out() { az deployment group show -g $RG -n core --query "properties.outputs.$1.value" -o tsv; }
KV_NAME=$(out keyVaultName); ACR_NAME=$(out acrName); PG_NAME=$(out postgresServerName); PG_FQDN=$(out postgresFqdn)
echo "$KV_NAME $ACR_NAME $PG_NAME $PG_FQDN"
```
This creates logs, the managed identity, the container registry, the Key Vault, role assignments and the Container Apps environment.
You get "Key Vault Secrets Officer" on the vault so that step 5 can write secrets.

## 5. Generate the secrets in Cloud Shell and store them in Key Vault (free)
The values are never printed and never written to a file. Your shell history only records the variable names, not the values.
```bash
DB_PASSWORD=$(openssl rand -hex 32)                  # 64 hex chars: URL-safe inside the connection string
JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')   # 64 chars (the API requires at least 32)
DATABASE_URL="postgres://helpdeskadmin:${DB_PASSWORD}@${PG_FQDN}:5432/helpdesk"
az keyvault secret set --vault-name $KV_NAME -n db-password       --value "$DB_PASSWORD"  -o none
az keyvault secret set --vault-name $KV_NAME -n jwt-access-secret --value "$JWT_SECRET"   -o none
az keyvault secret set --vault-name $KV_NAME -n database-url      --value "$DATABASE_URL" -o none
unset DB_PASSWORD JWT_SECRET DATABASE_URL
az keyvault secret list --vault-name $KV_NAME --query "[].name" -o tsv   # expect: database-url, db-password, jwt-access-secret
```
- `Forbidden` / `does not have secrets set permission` means the role from step 4 is still propagating. Wait 1–2 minutes and re-run the three `set` lines. If your session dropped in the meantime, re-run the whole block, which generates fresh values; that's fine because nothing uses them yet.
- `DATABASE_URL` deliberately has no `?sslmode=…`. The app turns on TLS with certificate verification through `DB_SSL=true`.

## 6. Deploy the database (about 5–10 min; 💰 about $0.65/day while running)
**6a. Preview:**
```bash
az deployment group what-if -g $RG -n database -f database.bicep -p prefix=$PREFIX
```
✅ **A good result** is `Resource changes: 4 to create.`: 1 × `flexibleServers` (`helpdesk-pg-…`, SKU `Standard_B1ms`,
tier `Burstable`, version `16`), 1 × `configurations` (`azure.extensions`), 1 × `databases` (`helpdesk`),
1 × `firewallRules` (`AllowAllAzureServicesAndResourcesWithinAzureIps`). The password shows as a Key Vault reference,
never as a value.
❌ An error mentioning `db-password` or `getSecret` means step 5 didn't finish. SKU, region or quota errors are covered in [Troubleshooting](#troubleshooting).

**6b. Deploy:**
```bash
az deployment group create -g $RG -n database -f database.bicep -p prefix=$PREFIX -o none
az postgres flexible-server show -g $RG -n $PG_NAME --query "{state:state, sku:sku.name, version:version}" -o table   # Ready, Standard_B1ms, 16
```
The admin password is read straight from Key Vault during deployment (`getSecret`), so it's never on the command line or in
deployment history.

## 7. One-time GitHub OIDC setup (free)
This lets GitHub Actions log in to Azure with short-lived tokens. There is **no client secret** anywhere, and access is limited to this
resource group plus pushing to the registry.
```bash
APP_ID=$(az ad app create --display-name helpdesk-github-deploy --query appId -o tsv)
az ad sp create --id $APP_ID -o none
SP_OID=$(az ad sp show --id $APP_ID --query id -o tsv)
az ad app federated-credential create --id $APP_ID --parameters "{
  \"name\": \"github-production\",
  \"issuer\": \"https://token.actions.githubusercontent.com\",
  \"subject\": \"repo:$GH_REPO:environment:production\",
  \"audiences\": [\"api://AzureADTokenExchange\"] }" -o none
az role assignment create --assignee-object-id $SP_OID --assignee-principal-type ServicePrincipal \
  --role Contributor --scope $(az group show -n $RG --query id -o tsv) -o none
az role assignment create --assignee-object-id $SP_OID --assignee-principal-type ServicePrincipal \
  --role AcrPush --scope $(az acr show -n $ACR_NAME --query id -o tsv) -o none
echo "AZURE_CLIENT_ID=$APP_ID"; echo "AZURE_TENANT_ID=$TENANT_ID"; echo "AZURE_SUBSCRIPTION_ID=$SUB_ID"
```
The subject must match exactly, including upper/lower case: `repo:Sujayweb3master/ai-projects:environment:production`.

## 8. Configure GitHub (free, in the GitHub web UI)
1. Repository → **Settings → Environments → New environment** → name it `production` → **Configure environment**.
2. Under **Environment variables** add these four. They are **variables, not secrets**: IDs, not credentials.

   | Name | Value |
   |---|---|
   | `AZURE_CLIENT_ID` | from step 7 |
   | `AZURE_TENANT_ID` | from step 7 |
   | `AZURE_SUBSCRIPTION_ID` | from step 7 |
   | `AZURE_RESOURCE_GROUP` | `helpdesk-rg` |

CLI alternative in Cloud Shell: run `gh auth login`, then for each variable
`gh variable set AZURE_CLIENT_ID --env production --body "$APP_ID" -R $GH_REPO`. The environment must exist first.

## 9. First deploy: push a tag (about 8–10 min; 💰 cents)
Deploys are triggered by tags named `helpdesk-v*` (see `.github/workflows/helpdesk-deploy.yml`). From your own computer:
```bash
git fetch origin feat/helpdesk-app && git tag helpdesk-v1 origin/feat/helpdesk-app && git push origin helpdesk-v1
```
Or from Cloud Shell: run `gh auth login && gh auth setup-git` once, then the same commands inside `~/ai-projects`
(the clone is shallow, so run `git fetch --unshallow origin feat/helpdesk-app` first if the tag push complains).

Watch it under GitHub → **Actions → helpdesk-deploy**. The workflow:
1. Builds both images and pushes them to your registry, tagged with the commit SHA.
2. Updates **only** the migration job and runs it. **If a migration fails, the deploy stops before the API or web change.**
3. Deploys the API (internal-only) and the web app (public).
4. Smoke-tests `/healthz` and `/api/v1/readyz` through the public URL. The run summary shows the URL.

Later deploys: push `helpdesk-v2`, `helpdesk-v3`, and so on.

## 10. Create the first admin (free)
1. Open the app URL: `WEB=https://$(az containerapp show -g $RG -n helpdesk-web --query properties.configuration.ingress.fqdn -o tsv); echo $WEB`.
   **Register** there with the email you want as admin.
2. Promote that account. This is the only time you touch the database directly:
```bash
ADMIN_EMAIL='you@example.com'    # the email you just registered
PGPASSWORD=$(az keyvault secret show --vault-name $KV_NAME -n db-password --query value -o tsv) \
psql "host=$PG_FQDN port=5432 dbname=helpdesk user=helpdeskadmin sslmode=require" -v email="$ADMIN_EMAIL" <<'SQL'
UPDATE users SET role = 'ADMIN' WHERE email = lower(:'email');
SQL
```
✅ Prints `UPDATE 1`. `UPDATE 0` means the email doesn't match what you registered.
If `psql` times out, Cloud Shell's IP isn't covered by the "Azure services" rule. Allow it temporarily:
```bash
MYIP=$(curl -s https://api.ipify.org)
az postgres flexible-server firewall-rule create -g $RG -n $PG_NAME -r cloudshell --start-ip-address $MYIP --end-ip-address $MYIP -o none
# …run the psql command again, then remove the rule:
az postgres flexible-server firewall-rule delete -g $RG -n $PG_NAME -r cloudshell --yes
```
3. Sign out and back in to the app. You'll now see **Users** in the navigation.

## 11. Verification (free)
Run these after step 9 (and step 10 for the admin checks). The first request can take about 10 s while an app scales up from zero.
```bash
WEB=https://$(az containerapp show -g $RG -n helpdesk-web --query properties.configuration.ingress.fqdn -o tsv)

# 1. Health through the single public origin
curl -s --retry 5 --retry-delay 5 --retry-all-errors $WEB/healthz;       echo   # {"status":"ok"}    (nginx)
curl -s --retry 5 --retry-delay 5 --retry-all-errors $WEB/api/v1/readyz; echo   # {"status":"ready"} (API → database)

# 2. Security headers on the web app
curl -sI $WEB/ | grep -iE 'content-security-policy|strict-transport-security|x-content-type-options'   # all three present

# 3. The API is not reachable from the internet
az containerapp show -g $RG -n helpdesk-api --query properties.configuration.ingress.external -o tsv    # false

# 4. A normal user gets 403 on admin endpoints; anonymous requests get 401
U_EMAIL="verify-$RANDOM@example.com"; U_PASS=$(openssl rand -hex 12)
U_TOKEN=$(curl -s -X POST $WEB/api/v1/auth/register -H 'content-type: application/json' \
  -d "{\"email\":\"$U_EMAIL\",\"name\":\"Verify User\",\"password\":\"$U_PASS\"}" | jq -r .accessToken)
curl -s -o /dev/null -w 'USER GET  /users            → %{http_code} (expect 403)\n' $WEB/api/v1/users -H "Authorization: Bearer $U_TOKEN"
curl -s -o /dev/null -w 'USER PATCH /users/:id/role   → %{http_code} (expect 403)\n' -X PATCH \
  $WEB/api/v1/users/00000000-0000-4000-8000-000000000000/role -H "Authorization: Bearer $U_TOKEN" \
  -H 'content-type: application/json' -d '{"role":"ADMIN"}'
curl -s -o /dev/null -w 'USER PATCH /tickets/:id/status → %{http_code} (expect 403)\n' -X PATCH \
  $WEB/api/v1/tickets/00000000-0000-4000-8000-000000000000/status -H "Authorization: Bearer $U_TOKEN" \
  -H 'content-type: application/json' -d '{"status":"CLOSED"}'
curl -s -o /dev/null -w 'USER GET  /auth/me          → %{http_code} (expect 200)\n' $WEB/api/v1/auth/me -H "Authorization: Bearer $U_TOKEN"
curl -s -o /dev/null -w 'ANON GET  /users            → %{http_code} (expect 401)\n' $WEB/api/v1/users

# 5. Refresh cookie: flags, same-origin refresh works, cross-origin refresh is rejected
curl -s -c jar -o /dev/null -D - -X POST $WEB/api/v1/auth/login -H 'content-type: application/json' \
  -d "{\"email\":\"$U_EMAIL\",\"password\":\"$U_PASS\"}" | grep -i '^set-cookie'
#   expect: hd_rt=…; Max-Age=604800; Path=/api/v1/auth; …; HttpOnly; Secure; SameSite=Strict   (no Domain=)
curl -s -b jar -c jar -o /dev/null -w 'refresh, same origin  → %{http_code} (expect 200)\n' -X POST \
  $WEB/api/v1/auth/refresh -H 'X-Requested-With: fetch' -H "Origin: $WEB"
curl -s -b jar -o /dev/null -w 'refresh, other origin → %{http_code} (expect 403)\n' -X POST \
  $WEB/api/v1/auth/refresh -H 'X-Requested-With: fetch' -H 'Origin: https://evil.example'
rm -f jar

# 6. The API sees your real IP (proves TRUST_PROXY_HOPS=3 is right for this chain of proxies)
echo "my IP: $(curl -s https://api.ipify.org)"
az containerapp logs show -g $RG -n helpdesk-api --tail 50 2>/dev/null | grep -oE 'clientIp[^0-9a-f]*[0-9a-f.:]+' | tail -3
#   expect the same IP. If you see a 100.x/10.x address instead, see Troubleshooting → "Wrong client IP".
```
Then sign in as the admin in a browser and click through: create a ticket, **Assign to me**, move it to *In progress* and then
*Resolved*, and deactivate the `verify-…` user on the **Users** page.

**Rollback triggers:** roll back (step 12) if any check above shows a different code than expected, if `/api/v1/readyz`
stays at 503 for more than 5 minutes after a deploy (and the database isn't stopped), or if signing in fails.

## 12. Rollback
- **Application:** GitHub → Actions → helpdesk-deploy → open the last good run → **Re-run all jobs**. That rebuilds the exact
  commit it deployed. Faster, using an image that's already in the registry:
  ```bash
  az containerapp update -g $RG -n helpdesk-api --image $ACR_NAME.azurecr.io/helpdesk-api:<previous-sha>
  az containerapp update -g $RG -n helpdesk-web --image $ACR_NAME.azurecr.io/helpdesk-web:<previous-sha>
  az acr repository show-tags -n $ACR_NAME --repository helpdesk-api -o table   # list available SHAs
  ```
- **Database:** migrations only move forward. Schema changes are written to be backward-compatible (add first, remove in a later
  release), so an older app version keeps working on the newer schema. Last resort: point-in-time restore to a **new** server
  (it costs extra while both exist):
  `az postgres flexible-server restore -g $RG -n ${PG_NAME}-restore --source-server $PG_NAME --restore-time "2026-10-05T10:00:00Z"`.

## 13. Saving money while idle
- The apps **scale to zero** when unused and cost nothing then. The first request afterwards takes a few seconds.
- **Stop the database** when you're done for the day (💰 saves about $0.50/day; the $0.13/day for storage still applies):
  ```bash
  az postgres flexible-server stop  -g $RG -n $PG_NAME     # the app shows errors and /readyz returns 503 while stopped
  az postgres flexible-server start -g $RG -n $PG_NAME     # about 2 min
  ```
  ⚠️ Azure **automatically restarts** a stopped server after 7 days.

## 14. Teardown: stop all charges (do this by **Oct 10**)
```bash
az group delete -n $RG --yes                                  # deletes EVERYTHING in the group (about 5–10 min)
az keyvault purge -n $KV_NAME -l $LOCATION                    # frees the soft-deleted vault immediately
APP_ID=${APP_ID:-$(az ad app list --display-name helpdesk-github-deploy --query "[0].appId" -o tsv)}
az ad app delete --id $APP_ID                                 # the GitHub deploy identity lives outside the resource group
az group exists -n $RG                                        # → false
az keyvault list-deleted --query "[?contains(name,'helpdesk')].name" -o tsv   # → empty after the purge
```
If `$KV_NAME` is empty because your session reset, get it from `az keyvault list-deleted -o table`. Optionally delete the
`production` environment in GitHub → Settings → Environments. After teardown the only thing left is the git tags in
the repo, which cost nothing.

---

## Production configuration: cookie, CORS and proxies
The browser only ever talks to **one origin**: `https://helpdesk-web.<environment-domain>.azurecontainerapps.io`.

| Setting | Value in Azure | Why |
|---|---|---|
| Public entry point | `helpdesk-web` (external ingress, HTTPS only) | nginx serves the app and proxies `/api/*` to `http://helpdesk-api` inside the environment |
| API ingress | `helpdesk-api`, **internal only** | Not reachable from the internet; only the web container can call it |
| Refresh cookie | `hd_rt`; `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`; **no `Domain`** | Host-only on the web URL. `*.azurecontainerapps.io` is on the Public Suffix List, so two apps there are different *sites*; the single origin is what makes `SameSite=Strict` work without a custom domain |
| `COOKIE_SECURE` | `true` | Cookie is only sent over HTTPS |
| `CORS_ORIGINS` | exactly `https://helpdesk-web.<environment-domain>` (set by `apps.bicep`) | Same-origin requests don't need CORS headers. The value is what `/auth/refresh` and `/auth/logout` check the `Origin` header against (CSRF defence); anything else gets 403 |
| `TRUST_PROXY_HOPS` | `3` | Web ingress → nginx → API internal ingress. Lets rate limiting see the real client IP without trusting spoofed headers. Verified by check 6 |
| Access token | JWT, 15 min, in browser memory only | Never stored in localStorage |
| Secrets | Key Vault: `db-password`, `database-url`, `jwt-access-secret` | Container Apps read them through the managed identity (Key Vault references). They never appear in templates, the workflow or logs |

## Troubleshooting
- **A resource fails on region, SKU or quota** (`SkuNotAvailable`, `LocationIsOfferRestricted`, `QuotaExceeded`,
  `RegionDoesNotAllowProvisioning`, "B1ms not available"): every resource must be in **one region**, and the templates follow the
  resource group's region. Start over in `southindia`:
  ```bash
  az group delete -n $RG --yes
  az keyvault purge -n $KV_NAME -l $LOCATION 2>/dev/null   # the vault name is reused, so purge the soft-deleted one first
  LOCATION=southindia
  ```
  Then redo the runbook from **step 3**. The resume block picks up the new region automatically.
- **Key Vault `Forbidden` in step 5:** the role assignment is still propagating. Wait 1–2 minutes and retry.
- **Step 6 fails with `ServerIsBusy` or a conflict:** re-run the same `az deployment group create` command. It's idempotent.
- **`az containerapp …` asks to install an extension:** answer **Y**, or run `az extension add -n containerapp --upgrade --yes`.
- **The deploy workflow fails at "Azure login":** check the four GitHub variables are on the `production` *environment*, and
  that the federated-credential subject matches exactly (step 7).
- **The workflow fails at "Run database migrations":** the API and web were not changed. Read the job's logs:
  ```bash
  WS=$(az monitor log-analytics workspace show -g $RG -n helpdesk-logs --query customerId -o tsv)
  az monitor log-analytics query -w $WS -o table --analytics-query \
    "ContainerAppConsoleLogs_CL | where ContainerJobName_s == 'helpdesk-migrate' | order by TimeGenerated desc | take 50 | project TimeGenerated, Log_s"
  ```
  (Logs can take a few minutes to arrive.) Common causes: the database is stopped (step 13), or the `database-url` secret is wrong (redo step 5).
- **`/api/v1/readyz` returns 503:** the database is stopped or unreachable. Run `az postgres flexible-server show -g $RG -n $PG_NAME --query state`.
- **The browser signs you out on reload, or refresh returns 403:** `CORS_ORIGINS` must equal the exact web URL. Check with
  `az containerapp show -g $RG -n helpdesk-api --query "properties.template.containers[0].env[?name=='CORS_ORIGINS']"`.
- **Wrong client IP in check 6:** if the IP shown is an internal address, adjust the hop count and redeploy.
  In `apps.bicep`, change the default of `trustProxyHops` (for example 2 or 4), commit, and push a new tag. Compare again.

## Known limitations of this deployment
- **The database firewall allows "Azure services".** The rule `0.0.0.0` lets any Azure-hosted resource, including other tenants', *attempt*
  a connection. Access still needs the 64-character password over TLS. The proper fix is VNet integration with a private endpoint, which
  costs more and adds complexity for a first deploy.
- **Registration is open to anyone** who knows the URL. Every new account is a normal USER, and admins can deactivate unwanted
  accounts. For real internal use, restrict sign-up (an invite flow, or Entra ID sign-in) or put the app behind Entra authentication.
- **Key Vault purge protection is off** so that teardown can purge the vault and a same-name redeploy works. With it off, a deleted vault
  (or secret) can be permanently purged during the 7-day soft-delete window. Turn it on for anything long-lived.
- The first admin is promoted by hand with `psql` (step 10).
- Rate limits are counted per replica (in memory). With 2 API replicas each counts separately.
- There are no alerts or dashboards: logs go to Log Analytics with a 0.1 GB/day cap and are kept for 30 days.
- Single region, no HA, 7-day backups. It's sized for a demo, not production traffic.
