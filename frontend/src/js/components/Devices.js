import React, { Component } from "react";
import { Query } from 'react-apollo';
import gql from 'graphql-tag';
import styled from 'styled-components';
import { Container, List, Icon, Card, Popup } from 'semantic-ui-react';
import moment from 'moment';

import SlideLabel from './SlideLabel';

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
  position: relative;
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
const GridOverlay = styled.div`
  z-index: 100;
  position: absolute;
  top: 0; bottom: 0; left: 0; right: 0;
  background: rgba(0,0,0,0.9);
  color: white;
  font-size: 0.8em;
  padding: 4px 3px 0 6px;
  overflow-y: auto;
  & ._close {
    font-size: 16px;
    position: absolute;
    right: 0;
  }
  & ._close:hover {
    cursor: pointer;
  }
  & table { 
    width: 100%; 
    th { text-align: left; }
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

function fmtDuration(ms) {
  if (ms < 1000) {
    return ms + 'ms';
  }
  if (ms >= 1000 && ms < 1000 * 60) {
    return moment(ms).format('s.SS') + 's';
  }
  if (ms >= 1000 * 60) {
    let m = moment(ms);
    return m.format('m') + 'm ' + m.format('s') + 's';
  }
}

function fromNow(when) {
  if (!when) { return 'never'; }
  return moment(when).from(new Date());
}

const SpoofStatus = ({pingSweep, portScan}) => (
    <GridHead>
      <div>
        <Icon name='target' disabled={!pingSweep.processing}/>
        {pingSweep.processing ? 
          `sweeping started ${fromNow(pingSweep.scanStart)}` :
          `sweep: ${fromNow(pingSweep.scanStart)} / ${fmtDuration(pingSweep.scanTime||0)}` 
        }
      </div>
      <div>
        <Icon name='crosshairs' disabled={!portScan.processing}/>
        {console.log(portScan.processing && portScan.scanStart)}
        {portScan.processing && portScan.scanStart ? 
          `${portScan.host} portscan started ${moment(portScan.scanStart).from(new Date())}` :
          `portscan: ${fromNow(portScan.scanStart)} / ${fmtDuration(portScan.scanTime||0)}` 
        }
      </div>
    </GridHead>
);

const DEVICES = gql`
  query devices {
    devices {
      mac,
      vendor,
      os,
      isSensor,
      isGateway,
      ips {
        ip,
        seen
      }
      ports {
        port,
        protocol,
        service,
        seen
      }
    }
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
          <SpoofStatus {...data.spoofStatus}/>
          {data.devices.map(d =>
            <Device 
              key={d.mac} 
              {...d} 
              activeIp={data.spoofStatus.portScan.host}
              isScanning={data.spoofStatus.portScan.processing}
            />
          )}
        </Grid>
      );
    }}
  </Query>
);



const renderDevice = ({showPorts, hidePorts, state, props: p}) => {
  let ip = latestIp(p.ips).ip;
  let beingScanned = p.isScanning && p.activeIp === ip;
  return (
    <GridItem>
      { state.showPorts && <GridOverlay>
        <Icon name='close' className='_close' onClick={hidePorts}/>
        <table>
            <thead><tr><th>port</th><th>service</th><th>seen</th></tr></thead>
            <tbody>
            {p.ports.map(port => (
              <tr key={port.port}>
                <td>{port.port}</td>
                <td>{port.service}</td>
                <td>{fromNow(port.seen)}</td>
              </tr>
            ))}
            </tbody>
        </table>
      </GridOverlay>}
      <div className='mac'>
        {p.isSensor && 
          <Popup 
            trigger={<Icon name='eye' style={{float:'right'}} />} 
            content='pi-net-mon sensor'
          />
        }
        {p.isGateway && 
          <Popup 
            trigger={<Icon name='hdd' style={{float: 'right'}} />} 
            content='gateway' 
          />
        }
        {p.mac}
      </div>
      <div className='ip'>
        { beingScanned ? <SlideLabel
              content={ip}
              label={'portscanning...'}
              color='#ff6c00'
            /> : ip
        } 
        { p.ports && p.ports.length && 
          <SlideLabel 
            content={p.ports.length} 
            label='open ports' 
            float='right' 
            color='#538eff'
            onClick={showPorts}
          /> 
        }
      </div>
      <hr />
      <div className='extra'>
        {p.vendor || '(no vendor discovered)'}<br/>
        {p.os || '(os not detected)'}
      </div>
      <hr />
      <div className='seen'>
        <Icon name='clock' />
        { moment(latestIp(p.ips).seen).from(new Date()) }
      </div>
    </GridItem>
  );
} 

class Device extends Component {
  state = { showPorts: false };
  showPorts = () => this.setState({ showPorts: !this.state.showPorts });
  hidePorts = () => this.setState({ showPorts: false });
  render() {return renderDevice(this)};
}

export default Devices;