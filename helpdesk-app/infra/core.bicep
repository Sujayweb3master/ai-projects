// Stage 1 of 3: shared foundation for the helpdesk app.
// Deploy:  az deployment group create -g helpdesk-rg -n core -f core.bicep -p prefix=helpdesk deployerObjectId=<your object id>
// Creates: Log Analytics, user-assigned identity, Container Registry, Key Vault (+ role assignments)
//          and the Container Apps environment. No secrets are passed in; you add them to Key Vault afterwards.
targetScope = 'resourceGroup'

@description('Short prefix used in every resource name.')
@minLength(3)
@maxLength(10)
param prefix string = 'helpdesk'

@description('Azure region. Defaults to the resource group location so everything shares one region.')
param location string = resourceGroup().location

@description('Object ID of the person running the runbook (az ad signed-in-user show --query id -o tsv). Granted "Key Vault Secrets Officer" so they can write the secrets.')
param deployerObjectId string

// Globally unique names need a suffix; derived from the RG id so re-deploys are idempotent.
var suffix = take(uniqueString(resourceGroup().id), 5)
var names = {
  logs: '${prefix}-logs'
  identity: '${prefix}-id'
  acr: toLower('${prefix}acr${suffix}')
  keyVault: '${prefix}-kv-${suffix}'
  postgres: '${prefix}-pg-${suffix}'
  environment: '${prefix}-env'
}
var tags = { project: prefix }

// Built-in role definition IDs.
var roles = {
  acrPull: '7f951dda-4ed3-4680-a7ca-43fe172d538d'
  keyVaultSecretsUser: '4633458b-17de-408a-b874-0445c86b69e6'
  keyVaultSecretsOfficer: 'b86a8fe4-44ce-4948-aee5-eccb2c155cd7'
}

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: names.logs
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
    // Hard cap on ingestion so logs can never run up the bill.
    workspaceCapping: { dailyQuotaGb: json('0.1') }
  }
}

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: names.identity
  location: location
  tags: tags
}

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: names.acr
  location: location
  tags: tags
  sku: { name: 'Basic' }
  properties: {
    adminUserEnabled: false // pulls use the managed identity; pushes use GitHub OIDC
  }
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: names.keyVault
  location: location
  tags: tags
  properties: {
    tenantId: subscription().tenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true
    // Lets database.bicep read the admin password with getSecret() instead of a parameter.
    enabledForTemplateDeployment: true
    softDeleteRetentionInDays: 7
    // Purge protection intentionally left off so the runbook's teardown can purge the vault
    // (see DEPLOY.md "Known limitations").
    publicNetworkAccess: 'Enabled'
  }
}

resource acrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: acr
  name: guid(acr.id, identity.id, roles.acrPull)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.acrPull)
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource identityReadsSecrets 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: keyVault
  name: guid(keyVault.id, identity.id, roles.keyVaultSecretsUser)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.keyVaultSecretsUser)
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource deployerWritesSecrets 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: keyVault
  name: guid(keyVault.id, deployerObjectId, roles.keyVaultSecretsOfficer)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.keyVaultSecretsOfficer)
    principalId: deployerObjectId
    principalType: 'User'
  }
}

resource environment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: names.environment
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
  }
}

output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri
output acrName string = acr.name
output acrLoginServer string = acr.properties.loginServer
output identityName string = identity.name
output environmentName string = environment.name
output environmentDefaultDomain string = environment.properties.defaultDomain
output postgresServerName string = names.postgres
output postgresFqdn string = '${names.postgres}.postgres.database.azure.com'
