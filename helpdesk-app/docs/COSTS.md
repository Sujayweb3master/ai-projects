# Estimated Azure costs

These are approximate **list prices in USD** for `centralindia`, based on published Azure pricing. They could not be checked live
from the build environment, so run the price check in [DEPLOY.md step 1](DEPLOY.md#1-set-variables-free) before deploying.
Credits and taxes aren't included.

| Resource | SKU / settings | ≈ per month | ≈ per day | ≈ Oct 1–10 (10 days) |
|---|---|---|---|---|
| PostgreSQL Flexible Server compute | `Standard_B1ms` Burstable (1 vCore, 2 GiB), running 24/7 | $15–17 | $0.53 | $5.30 |
| PostgreSQL storage | 32 GiB (backups up to 32 GiB included) | $4 | $0.13 | $1.30 |
| Container Registry | Basic | $5 | $0.17 | $1.70 |
| Container Apps: web + api + migrate job | 0.25 vCPU / 0.5 GiB each, **scale to zero** | $0* | $0 | $0 |
| Log Analytics | pay-as-you-go, **0.1 GB/day cap**, 30-day retention | $0 (5 GB/month free) | $0 | $0 |
| Key Vault | Standard, a few hundred operations | < $0.10 | — | < $0.05 |
| Outbound data | a few GB | $0 (first 100 GB free) | $0 | $0 |
| **Total** | | **≈ $25/month** | **≈ $0.85/day** | **≈ $9** |

\* The Container Apps consumption plan includes a monthly free grant of 180,000 vCPU-seconds, 360,000 GiB-seconds and
2 million requests. With `minReplicas: 0`, apps use nothing while idle, so light testing stays inside the grant.

## What changes the bill
| Scenario | Effect |
|---|---|
| Stop the database outside working hours (`az postgres flexible-server stop`) | Saves about **$0.50/day** of compute; storage is still billed |
| Both apps kept warm 24/7 (min replicas 1, never scaling to zero) | Adds about **$30/month** beyond the free grant |
| Point-in-time restore (rollback last resort) | A second B1ms server, about **$0.65/day** while it exists |
| Deploys (image builds happen on GitHub-hosted runners) | Registry storage for a few images is well inside Basic's 10 GiB; builds cost $0 on Azure |
| **Teardown** (`az group delete`) | **$0** from then on |

Ways to keep an eye on spending: Azure portal → **Cost Management → Cost analysis**, scoped to `helpdesk-rg`. Some credit-based
subscriptions don't support budgets or alerts, so check the cost analysis every couple of days instead.
