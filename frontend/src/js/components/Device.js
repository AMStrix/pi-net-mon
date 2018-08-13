import React, { Component } from "react";
import ReactDOM from "react-dom";
import { graphql, Query, Mutation } from 'react-apollo';
import { Icon, Checkbox, Popup } from 'semantic-ui-react';
import styled from 'styled-components';
import moment from 'moment';

import { orange, grayText } from '../colors';
import { DEVICE } from './gql';
import Grid from './Grid';
import Value from './Value';
import Seen from './Seen';
import NameDeviceControl from './NameDeviceControl';
import SpoofControl from './SpoofControl';
import ScanControl from './ScanControl';
import DeviceHostChart from './DeviceHostChart';

const Style = styled.div`
  margin: 8px 8px 0 8px;
  .deviceName {
    display: inline-block;
    margin: 0 0 10px 0;
    font-size: 1.6em;
    cursor: pointer;
    & .unset {
      color: ${grayText};
    }
    .icon {
      font-size: 0.55em;
      margin: 0 0.3em;
      vertical-align: top;
    }
  }
  .extra, .scanControl {
    margin: 8px 12px 8px 0;
    display: inline-block;
  }
  .ports table {
    border-spacing: 0;
    line-height: 1.1em;
    font-size: 0.9em;
    margin: 3px 0 3px 0;
    th, td {
      text-align: left;
      padding-right: 6px;
    }
    th:first-child, td:first-child {
      text-align: right;
    }
  }
`;

let deviceNameTrigger = null;

const Device = ({ match: { params: { mac }}}) => (
  <Style>
    <Query query={DEVICE} variables={{ mac: mac }}>
      {({loading, error, data}) => {
        if (loading) return 'Loading...';
        if (error) return `Error! ${error.message}`;
        const {device, spoofStatus} = data;
        if (!device) return `Device ${mac} not found.`;
        return (
          <div>

            <Popup
              trigger={
                <div className='deviceName' ref={x => deviceNameTrigger = x}>
                  {device.name || <span className='unset'>(unnamed)</span>}
                  <a href='#' onClick={e=>e.preventDefault()}>
                    <Icon name='edit'/>
                  </a>
                </div>
              }
              content={<NameDeviceControl onSuccess={() => 
                // close popup
                setTimeout(() => deviceNameTrigger.click(), 0)
              } 
              focus={true} {...device} />}
              on='click'
            />

            <div style={{ display: 'flex' }}>
              <Value inline label='mac' value={mac} />
              <Value inline label='ip' value={device.latestIp.ip} />
              <Seen 
                when={device.latestIp.seen} 
                tip='last time this device was pinged/scanned' 
                margin='0 0 0 4px'
              />
            </div>

            {device.isSensor&&<div className='extra'>
              <Icon name='info circle' style={{ color: orange() }}/>
              this is the pi-net-mon device
            </div>}

            {device.isGateway&&<div className='extra'>
              <Icon name='info circle' style={{ color: orange() }}/>
              this is the gateway device
            </div>}

            <div>
            
              <Value 
                small 
                label='first detected' 
                value={device.birthday && moment(device.birthday).calendar()||'(no birthday)'} 
              />
              <Value small label='vendor' value={device.vendor||'(none detected)'} />
              <Value small label='os' value={device.os||'(none detected)'} />
              <Value 
                small 
                label='open ports' 
                value={!device.ports.length && 'no open ports discovered' || <Ports ports={device.ports} />}
              />

              <DeviceHostChart mac={mac} />

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

const Ports = ({ports}) => (
  <div className='ports'>
    <table>
      <thead><tr><th>port</th><th>service</th><th>seen</th></tr></thead>
      <tbody>
      {ports.map(port => (
        <tr key={port.port}>
          <td>{port.port}</td>
          <td>{port.service}</td>
          <td>{moment(port.seen).from(new Date())}</td>
        </tr>
      ))}
      </tbody>                
    </table>
  </div>
);

export default Device;