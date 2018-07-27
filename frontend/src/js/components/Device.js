import React, { Component } from "react";
import ReactDOM from "react-dom";
import { graphql, Query, Mutation } from 'react-apollo';
import gql from 'graphql-tag';
import { Icon, Checkbox } from 'semantic-ui-react'
import styled from 'styled-components';
import moment from 'moment';

import { orange } from '../colors';
import { DEVICE } from './gql';
import Grid from './Grid';
import Value from './Value';
import Seen from './Seen';
import SpoofControl from './SpoofControl';
import ScanControl from './ScanControl';

const Style = styled.div`
  margin: 8px 8px 0 8px;
  .info, .scanControl {
    margin-top: 8px;
  }
`;

const Device = ({ match: { params: { mac }}}) => (
  <Style>
    <Query query={DEVICE} variables={{ mac: mac }}>
      {({loading, error, data: {device, spoofStatus}}) => {
        if (loading) return 'Loading...';
        if (error) return `Error! ${error.message}`;
        return (
          <div>
            <div style={{ display: 'flex' }}>
              <Value inline label='mac' value={mac} />
              <Value inline label='ip' value={device.latestIp.ip} />
              <Seen when={device.latestIp.seen} tip='last time this device was pinged' margin='0 0 0 4px'/>
            </div>

            {device.isSensor&&<div className='info'>
              <Icon name='info circle' style={{ color: orange() }}/>
              this is the pi-net-mon device
            </div>}
            {device.isGateway&&<div className='info'>
              <Icon name='info circle' style={{ color: orange() }}/>
              this is the gateway device
            </div>}
            <div>
              <Value small label='vendor' value={device.vendor||'(none detected)'} />
              <Value small label='os' value={device.os||'(none detected)'} />
              <div>
                <SpoofControl device={device} type='toggle' />
              </div>
              <div className='scanControl'>
                <ScanControl 
                  size='small'
                  {...device} 
                  isScanning={spoofStatus.portScan.processing} 
                />
                { (device.beingPortscanned && 'Scanning...') ||
                  (spoofStatus.portScan.processing &&
                  `Portscan in progress on ${spoofStatus.portScan.host}`) ||
                  `Last portscan ${moment(device.lastPortscanTime).from(new Date())}`
                }
              </div>
            </div>
          </div>
        );
      }}
    </Query>
  </Style>
);

export default Device;