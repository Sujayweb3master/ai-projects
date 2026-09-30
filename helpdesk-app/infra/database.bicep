// Stage 2 of 3: PostgreSQL Flexible Server.
// Deploy AFTER core.bicep and AFTER you have stored the `db-password` secret in Key Vault:
//   az deployment group create -g helpdesk-rg -n database -f database.bicep -p prefix=helpdesk
// The admin password is read from Key Vault at deploy time with getSecret(); it is never a
// parameter value, never in a file and never in deployment history.
targetScope = 'resourceGroup'

@minLength(3)
@maxLength(10)
param prefix string = 'helpdesk'

param location string = resourceGroup().location

var suffix = take(uniqueString(resourceGroup().id), 5)

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: '${prefix}-kv-${suffix}'
}

module postgres 'modules/postgres.bicep' = {
  name: 'postgres'
  params: {
    serverName: '${prefix}-pg-${suffix}'
    location: location
    tags: { project: prefix }
    administratorLoginPassword: keyVault.getSecret('db-password')
  }
}

output postgresServerName string = postgres.outputs.serverName
output postgresFqdn string = postgres.outputs.fqdn
