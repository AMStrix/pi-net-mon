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
      hits
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
  mutation spoofDevice($ip: String!, $isSpoof: Boolean) {
    spoofDevice(ip: $ip, isSpoof: $isSpoof) {
      devices {...FullDevice}
      spoofError
    }
  }
  ${FULL_DEVICE}
`;

export const ACTIVE_HOSTS = gql`
  query activeHosts($period: String) {
    activeHosts(period: $period) {
      id
      host
      hits
    }
  }
`;

export const REMOTE_HOSTS = gql`
  query remoteHosts($sortField: String, $sortDir: Int, $skip: Int, $limit: Int) {
    remoteHosts(sortField: $sortField, sortDir: $sortDir, skip: $skip, limit: $limit) {
      id
      host
      birthday
      latestHit
      latestMac
      latestDeviceName
      assocHost
      sources
      protocols
      services
      macs
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


