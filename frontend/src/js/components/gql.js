import gql from 'graphql-tag';

export const SPOOF_STATUS = `
    errors
    pingSweep {
      host
      scanStart
      scanTime
      processing
    }
    portScan {
      host
      scanStart
      scanTime
      processing
    }
`;

export const FULL_DEVICE = gql`
  fragment FullDevice on Device { 
    id
    mac
    name
    birthday
    vendor
    os
    isSensor
    isGateway
    isSpoof
    spoofConflict
    beingPortscanned
    lastPortscanTime
    latestIp { ip seen }
    ips { ip seen }
    ports {
      port
      protocol
      service
      seen
    }
  }
`;

export const DEVICE = gql`
  query device($mac: String!) {
    device(mac: $mac) {
      ...FullDevice
    }
    spoofStatus {${SPOOF_STATUS}}
  }
  ${FULL_DEVICE}
`;

export const DEVICES = gql`
  query devices {
    devices {...FullDevice}
    spoofStatus {${SPOOF_STATUS}}
  }
  ${FULL_DEVICE}
`;

export const SCAN = gql`
  mutation scan($ip: String!) {
    scan(ip: $ip) {
      devices {...FullDevice}
      spoofStatus {${SPOOF_STATUS}}
      scanError
    }
  }
  ${FULL_DEVICE}
`;

export const SPOOF_DEVICE = gql`
  mutation spoofDevice($mac: String!, $isSpoof: Boolean) {
    spoofDevice(mac: $mac, isSpoof: $isSpoof) {
      devices {...FullDevice}
      spoofError
    }
  }
  ${FULL_DEVICE}
`;

export const FULL_REMOTE_HOST = gql`
  fragment FullRemoteHost on RemoteHost { 
    id
    host
    birthday
    latestHit
    latestMac
    latestDeviceName
    assocHosts
    sources
    protocols
    services
    macs
    devices {...FullDevice}
  }
  ${FULL_DEVICE}
`;

export const REMOTE_HOST = gql`
  query remoteHost($host: String!) {
    remoteHost(host: $host) {
      ...FullRemoteHost
    }
  }
  ${FULL_REMOTE_HOST}
`;

export const REMOTE_HOSTS = gql`
  query remoteHosts($sortField: String, $sortDir: Int, $skip: Int, $limit: Int, $hostSearch: String, $filter: String) {
    remoteHosts(sortField: $sortField, sortDir: $sortDir, skip: $skip, limit: $limit, hostSearch: $hostSearch, filter: $filter) {
      id
      host
      birthday
      latestHit
      latestMac
      latestDeviceName
      assocHosts
      sources
      protocols
      services
      macs
    }
  }
`;

export const REMOTE_HOSTS_PAGE = gql`
  query remoteHostsPage($sortField: String, $sortDir: Int, $skip: Int, $limit: Int, $hostSearch: String, $filter: String) {
    remoteHostsPage(sortField: $sortField, sortDir: $sortDir, skip: $skip, limit: $limit, hostSearch: $hostSearch, filter: $filter) {
      count
      hosts {
        id
        host
        birthday
        latestHit
        latestMac
        latestDeviceName
        assocHosts
        sources
        protocols
        services
        macs
      }
    }
  }
`;

export const DEPLOY_BRO = gql`
  mutation deploy {
    deployBro {
      isDeployed
      status
      errors
    }
  }
`;

export const BRO_STATUS = gql`
  query broStatus {
    broStatus {
      version
      isDeployed
      status
      errors
    }
  }
`;

export const NAME_DEVICE = gql`
  mutation nameDevice($mac: String!, $name: String!){
    nameDevice(mac: $mac, name: $name) {
      device { ...FullDevice }
      error
    }
  }
  ${FULL_DEVICE}
`;

export const DEVICE_HITS_24HR = gql`
  query deviceHits24hr($mac: String!, $date: Date!) {
    deviceHits24hr(mac: $mac, date: $date)
  }
`;

export const HOST_HITS_24HR = gql`
  query hostHits24hr($host: String!, $date: Date!) {
    hostHits24hr(host: $host, date: $date)
  }
`;

export const ALL_HOST_HITS_24HR = gql`
  query allHostHits24hr($date: Date!) {
    allHostHits24hr(date: $date)
  }
`;

export const THREAT_FEEDS = gql`
  query threatFeeds {
    threatFeeds {
      id
      type
      description
      name
      lastupdate
      datatype
      frequency
      active
      count
      rulesCount
      processing
      error
      lastPull
      ignored
    }
  }
`;

export const ACTIVATE_THREAT_FEED = gql`
  mutation activateThreatFeed($id: String!, $active: Boolean!) {
    activateThreatFeed(id: $id, active: $active) {
      id
      active
      rulesCount
      processing
      error
    }
  }
`;

export const FULL_THREAT_RULE = gql`
  fragment FullThreatRule on ThreatRule { 
    ipv4
    domain 
    date 
    lastSeen 
    feed 
  }
`;

export const FULL_ALERT = gql`
  fragment FullAlert on Alert {
      id
      time
      type
      level
      mac
      deviceName
      ip
      domain
      ipThreat { ...FullThreatRule }
      domainThreat { ...FullThreatRule }
      broUid
  }
  ${FULL_THREAT_RULE}
`;

export const ALERTS = gql`
  query alerts {
    alerts { ...FullAlert }
  }
  ${FULL_ALERT}
`;

export const ALERT_ACTION = gql`
  mutation alertAction($id: String!, $action: String!) {
    alertAction(id: $id, action: $action) {
      ...FullAlert
    }
  }
  ${FULL_ALERT}
`;





