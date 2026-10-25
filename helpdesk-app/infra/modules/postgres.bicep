// PostgreSQL Flexible Server sized for a low-cost demo: Burstable B1ms, 32 GiB, no HA.
param serverName string
param location string
param tags object

@secure()
param administratorLoginPassword string

param administratorLogin string = 'helpdeskadmin'
param databaseName string = 'helpdesk'

resource server 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: serverName
  location: location
  tags: tags
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    version: '16'
    administratorLogin: administratorLogin
    administratorLoginPassword: administratorLoginPassword
    authConfig: {
      passwordAuth: 'Enabled'
      activeDirectoryAuth: 'Disabled'
    }
    storage: {
      storageSizeGB: 32
      autoGrow: 'Disabled'
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: { mode: 'Disabled' }
    network: { publicNetworkAccess: 'Enabled' }
  }
}

// Azure only allows extensions that are allow-listed; the first migration runs
// CREATE EXTENSION pg_trgm (title search index).
resource extensions 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2024-08-01' = {
  parent: server
  name: 'azure.extensions'
  properties: {
    value: 'PG_TRGM'
    source: 'user-override'
  }
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: server
  name: databaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
  dependsOn: [extensions]
}

// "Allow public access from any Azure service": lets Container Apps (no VNet) reach the server.
// Trade-off documented in DEPLOY.md "Known limitations". TLS is enforced by the server
// (require_secure_transport is on by default) and the app verifies the certificate.
resource allowAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = {
  parent: server
  name: 'AllowAllAzureServicesAndResourcesWithinAzureIps'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
  dependsOn: [database]
}

output serverName string = server.name
output fqdn string = server.properties.fullyQualifiedDomainName
