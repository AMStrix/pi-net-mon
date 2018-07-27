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
  .ports table {
    border-spacing: 0;
    line-height: 1.1em;
    font-size: 0.9em;
    margin: 3px 0 12px 0;
    th, td {
      text-align: left;
      padding-right: 6px;
    }
    th:first-child, td:first-child {
      text-align: right;
    }
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
              <Seen 
                when={device.latestIp.seen} 
                tip='last time this device was pinged/scanned' 
                margin='0 0 0 4px'
              />
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
              <Value small label='first detected' value={device.birthday && moment(device.birthday).calendar()||'(no birthday)'} />
              <Value small label='vendor' value={device.vendor||'(none detected)'} />
              <Value small label='os' value={device.os||'(none detected)'} />
              { !device.ports.length && 'no open ports discovered' }
              { device.ports.length > 0 && 
                  <div className='ports'>
                  <b>Open Ports</b>
                  <table>
                    <thead><tr><th>port</th><th>service</th><th>seen</th></tr></thead>
                    <tbody>
                    {device.ports.map(port => (
                      <tr key={port.port}>
                        <td>{port.port}</td>
                        <td>{port.service}</td>
                        <td>{moment(port.seen).from(new Date())}</td>
                      </tr>
                    ))}
                    </tbody>                
                  </table>
                </div>
              }
              <hr/>
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
                  `Last portscan ${moment(device.lastPortscanTime).calendar()}`
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