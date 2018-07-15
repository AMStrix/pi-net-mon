import React, { Component } from "react";
import { Query } from 'react-apollo';
import gql from 'graphql-tag';
import styled from 'styled-components';
import { Container, List, Icon, Card, Popup } from 'semantic-ui-react';
import moment from 'moment';

const itemW = 250;
const gutter = 5;
const padding = 8;
const boxShadow = '1px 1px 5px #b1b1b1';
const Grid = styled.div`
  align-self: flex-start;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
`;
const GridHead = styled.div`
  width: 100%;
  background: white;
  box-shadow: ${boxShadow};
  margin: ${gutter}px;
  padding: ${padding}px;
`;
const GridItem = styled.div`
  width: ${itemW}px;
  margin: ${gutter}px;
  padding: ${padding}px;
  background: white;
  box-shadow: ${boxShadow};
  & hr {
    border-width: 0.5px;
    border-style: solid;
    border-color: #dcdcdc;
    margin: 3px -${padding}px 3px;
  }
  & .extra {
    font-size: 0.8em;
  }
  & .seen {
    font-size: 0.8em;
    color: #9a9a9a;
  }
`;

const SPOOF_STATUS = gql`
  query spoofStatus {
    spoofStatus {
      errors,
      pingSweep {
        host,
        scanStart,
        scanTime,
        processing
      }
      portScan {
        host,
        scanStart,
        scanTime,
        processing
      }
    }
  }
`;

const SpoofStatus = () => (
  <Query query={SPOOF_STATUS} pollInterval={5000}>
    {({ loading, error, data }) => {
      if (loading) return 'loading...';
      if (error) return 'Error! ' + error.message;
      let ping = data.spoofStatus.pingSweep;
      let scan = data.spoofStatus.portScan;
      return (
        <GridHead>
          <div>
            <Icon name='target' disabled={!ping.processing}/>
            {ping.processing ? 
              `sweeping, started ${moment(ping.scanStart).from(new Date())}` :
              `last sweep took ${ping.scanTime||0}ms` 
            }
          </div>
          <div>
            <Icon name='crosshairs' disabled={!scan.processing}/>
            {scan.processing ? 
              `portscan, started ${moment(scan.scanStart).from(new Date())}` :
              `last portscan took ${scan.scanTime||0}ms` 
            }
          </div>
        </GridHead>
      )
    }}
  </Query>
);

const DEVICES = gql`
  query devices {
    devices {
      mac,
      vendor,
      isSensor,
      isGateway,
      ips {
        ip,
        seen
      }
    }
  }
`;

function latestIp(ips) {
  return ips.reduce((latest, ip) => {
    if (Date.parse(latest.seen) - Date.parse(ip.seen) > 0) {
      return latest;
    } else {
      return ip;
    }
  });
}

const Devices = () => (
  <Query query={DEVICES} pollInterval={5000}>
    {({ loading, error, data }) => {
      if (loading) return "Loading...";
      if (error) return `Error! ${error.message}`;

      return (
        <Grid>
          <SpoofStatus />
          {data.devices.map(d =><Device key={d.mac} {...d} />)}
        </Grid>
      );
    }}
  </Query>
);

const Device = ({mac, ips, vendor, isSensor, isGateway}) => (
  <GridItem>
    <div className='mac'>
      {isSensor && 
        <Popup trigger={<Icon name='eye' style={{float:'right'}} />} content='pi-net-mon sensor' />
      }
      {isGateway && 
        <Popup trigger={<Icon name='hdd' style={{float: 'right'}} />} content='gateway' />
      }
      {mac}
    </div>
    <div className='ip'>{latestIp(ips).ip}</div>
    <hr />
    <div className='extra'>{vendor || '(no vendor discovered)'}</div>
    <hr />
    <div className='seen'>
      <Icon name='clock' />
      { moment(latestIp(ips).seen).from(new Date()) }
    </div>
  </GridItem>
);

export default Devices;