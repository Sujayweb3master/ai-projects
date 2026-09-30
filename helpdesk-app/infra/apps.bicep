// Stage 3 of 3: the migration job and the two Container Apps. Deployed by the GitHub
// workflow (.github/workflows/helpdesk-deploy.yml), not by hand:
//   1. deployServices=false  → only the migrate job is created/updated to the new image
//   2. the workflow runs the job and waits for it to succeed
//   3. deployServices=true   → API and web are updated to the new image
// Secrets are Key Vault references resolved at runtime by the managed identity; no secret
// values pass through this template or the workflow.
targetScope = 'resourceGroup'

@minLength(3)
@maxLength(10)
param prefix string = 'helpdesk'

param location string = resourceGroup().location

@description('Image tag to deploy (the workflow uses the git commit SHA).')
param imageTag string

@description('false = only update the migration job; true = also deploy API and web.')
param deployServices bool = true

@description('Proxies in front of the API: web ingress (envoy) → nginx → API internal ingress.')
param trustProxyHops int = 3

var suffix = take(uniqueString(resourceGroup().id), 5)
var tags = { project: prefix }
var apiName = '${prefix}-api'
var webName = '${prefix}-web'

resource environment 'Microsoft.App/managedEnvironments@2024-03-01' existing = {
  name: '${prefix}-env'
}
resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = {
  name: '${prefix}-id'
}
resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: toLower('${prefix}acr${suffix}')
}
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: '${prefix}-kv-${suffix}'
}

// The single public origin the browser uses; the API only accepts Origin checks from it.
var webOrigin = 'https://${webName}.${environment.properties.defaultDomain}'

var managedIdentity = {
  type: 'UserAssigned'
  userAssignedIdentities: { '${identity.id}': {} }
}
var registries = [
  {
    server: acr.properties.loginServer
    identity: identity.id
  }
]
// Key Vault references: the container platform fetches the value with the managed identity.
var databaseUrlSecret = {
  name: 'database-url'
  keyVaultUrl: '${keyVault.properties.vaultUri}secrets/database-url'
  identity: identity.id
}
var jwtSecret = {
  name: 'jwt-access-secret'
  keyVaultUrl: '${keyVault.properties.vaultUri}secrets/jwt-access-secret'
  identity: identity.id
}
var smallResources = {
  cpu: json('0.25')
  memory: '0.5Gi'
}

resource migrateJob 'Microsoft.App/jobs@2024-03-01' = {
  name: '${prefix}-migrate'
  location: location
  tags: tags
  identity: managedIdentity
  properties: {
    environmentId: environment.id
    configuration: {
      triggerType: 'Manual'
      replicaTimeout: 600
      replicaRetryLimit: 0 // a failed migration must fail the deploy, not silently retry
      manualTriggerConfig: {
        parallelism: 1
        replicaCompletionCount: 1
      }
      registries: registries
      secrets: [databaseUrlSecret]
    }
    template: {
      containers: [
        {
          name: 'migrate'
          image: '${acr.properties.loginServer}/helpdesk-api:${imageTag}'
          command: ['node', 'src/db/migrate.js']
          resources: smallResources
          env: [
            { name: 'DATABASE_URL', secretRef: 'database-url' }
            { name: 'DB_SSL', value: 'true' }
          ]
        }
      ]
    }
  }
}

resource api 'Microsoft.App/containerApps@2024-03-01' = if (deployServices) {
  name: apiName
  location: location
  tags: tags
  identity: managedIdentity
  properties: {
    environmentId: environment.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: false // not reachable from the internet; only the web app calls it
        targetPort: 3000
        transport: 'auto'
        allowInsecure: true // plain HTTP inside the environment (web → http://helpdesk-api)
      }
      registries: registries
      secrets: [databaseUrlSecret, jwtSecret]
    }
    template: {
      containers: [
        {
          name: 'api'
          image: '${acr.properties.loginServer}/helpdesk-api:${imageTag}'
          resources: smallResources
          env: [
            { name: 'NODE_ENV', value: 'production' }
            { name: 'PORT', value: '3000' }
            { name: 'LOG_LEVEL', value: 'info' }
            { name: 'DATABASE_URL', secretRef: 'database-url' }
            { name: 'DB_SSL', value: 'true' }
            { name: 'JWT_ACCESS_SECRET', secretRef: 'jwt-access-secret' }
            { name: 'CORS_ORIGINS', value: webOrigin }
            { name: 'COOKIE_SECURE', value: 'true' }
            { name: 'TRUST_PROXY_HOPS', value: string(trustProxyHops) }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: { path: '/healthz', port: 3000 }
              periodSeconds: 30
            }
            {
              type: 'Readiness'
              httpGet: { path: '/readyz', port: 3000 }
              periodSeconds: 10
              failureThreshold: 3
            }
          ]
        }
      ]
      scale: {
        minReplicas: 0 // scale to zero when idle → no compute cost
        maxReplicas: 2
        rules: [
          {
            name: 'http'
            http: { metadata: { concurrentRequests: '50' } }
          }
        ]
      }
    }
  }
  dependsOn: [migrateJob]
}

resource web 'Microsoft.App/containerApps@2024-03-01' = if (deployServices) {
  name: webName
  location: location
  tags: tags
  identity: managedIdentity
  properties: {
    environmentId: environment.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 8080
        transport: 'auto'
        allowInsecure: false // HTTP is redirected to HTTPS
      }
      registries: registries
    }
    template: {
      containers: [
        {
          name: 'web'
          image: '${acr.properties.loginServer}/helpdesk-web:${imageTag}'
          resources: smallResources
          env: [{ name: 'API_UPSTREAM', value: 'http://${apiName}' }]
          probes: [
            {
              type: 'Liveness'
              httpGet: { path: '/healthz', port: 8080 }
              periodSeconds: 30
            }
            {
              type: 'Readiness'
              httpGet: { path: '/healthz', port: 8080 }
              periodSeconds: 10
            }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 2
        rules: [
          {
            name: 'http'
            http: { metadata: { concurrentRequests: '100' } }
          }
        ]
      }
    }
  }
  dependsOn: [api]
}

output webUrl string = webOrigin
output migrateJobName string = migrateJob.name
