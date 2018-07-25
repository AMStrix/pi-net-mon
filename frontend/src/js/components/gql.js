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
    mac
    vendor
    os
    isSensor
    isGateway
    isSpoof
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
      spoofStatus {${SPOOF_STATUS}}
      scanError
    }
  }
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