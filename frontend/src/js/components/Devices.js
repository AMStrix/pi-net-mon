import React, { Component } from "react";
import { Query } from 'react-apollo';
import gql from 'graphql-tag';
import styled from 'styled-components';
import { Container, List, Icon, Card, Popup, Grid } from 'semantic-ui-react';
import moment from 'moment';

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

const SpoofStatusWrap = styled.div`
  background: white;
  padding: 8px;
`;

const SpoofStatus = () => (
  <Query query={SPOOF_STATUS} pollInterval={5000}>
    {({ loading, error, data }) => {
      if (loading) return 'loading...';
      if (error) return 'Error! ' + error.message;
      let ping = data.spoofStatus.pingSweep;
      let scan = data.spoofStatus.portScan;
      return (
        <SpoofStatusWrap>
          <div>
            <Icon rotated='clockwise' name='wifi' disabled={!ping.processing}/>
            {ping.processing ? 
              `sweeping, started ${moment(ping.scanStart).from(new Date())}` :
              `last sweep took ${ping.scanTime||0}ms` 
            }
          </div>
          <div>
            <Icon name='target' disabled={!scan.processing}/>
            {scan.processing ? 
              `portscan, started ${moment(scan.scanStart).from(new Date())}` :
              `last portscan took ${scan.scanTime||0}ms` 
            }
          </div>
        </SpoofStatusWrap>
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
      ips {
        ip,
        seen
      }
    }
  }
`;

const Devices = () => (
  <Query query={DEVICES} pollInterval={5000}>
    {({ loading, error, data }) => {
      if (loading) return "Loading...";
      if (error) return `Error! ${error.message}`;

      return (
        <Grid>
          <Grid.Column width={16}>
            <SpoofStatus />
          </Grid.Column>
            {data.devices.map(d =>
              <Device key={d.mac} {...d} />
            )}
            <div style={{clear: 'both'}} >&nbsp;</div>
        </Grid>
      );
    }}
  </Query>
);

function latestIp(ips) {
  return ips.reduce((latest, ip) => {
    if (Date.parse(latest.seen) - Date.parse(ip.seen) > 0) {
      return latest;
    } else {
      return ip;
    }
  });
}

const Device = ({mac, ips, vendor, isSensor}) => (
  <Grid.Column mobile={16} tablet={8} computer={4} largeScreen={4} widescreen={2}>
    <Card fluid style={{ height: '100%' }}>
      <Card.Content>
        <Card.Header>
          {isSensor && 
            <Popup trigger={<Icon name='eye' />} content='pi-net-mon sensor' />
          }   
          {mac}
        </Card.Header>
        <Card.Meta>
          <span>{latestIp(ips).ip}</span>
        </Card.Meta>
        <Card.Description>{vendor || '(no vendor discovered)'}</Card.Description>
      </Card.Content>
      <Card.Content extra>
        <a>
          <Icon name='clock' />
          { moment(latestIp(ips).seen).from(new Date()) }
        </a>
      </Card.Content>
    </Card>
  </Grid.Column>
);



export default Devices;