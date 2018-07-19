import React, { Component } from "react";
import { Query, Mutation } from 'react-apollo';
import gql from 'graphql-tag';
import styled from 'styled-components';
import { Button, Icon, Popup } from 'semantic-ui-react';
import moment from 'moment';

import SlideLabel from './SlideLabel';

const SPOOF_STATUS = `
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

const DEVICES = gql`
  query devices {
    devices {
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
    spoofStatus {${SPOOF_STATUS}}
  }
`;

const SCAN = gql`
  mutation scan($ip: String!) {
    scan(ip: $ip) {
      spoofStatus {${SPOOF_STATUS}}
      scanError
    }
  }
`;

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
  padding: ${padding * (1/2)}px ${padding}px ${padding * (3/8)}px;
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
  ._scanButton {
    visibility: hidden;
    opacity: 0;
    transition: visibility 0s, opacity 300ms linear;
  }
  &:hover ._scanButton {
    visibility: visible;
    opacity: 1;
  }
`;
const GridOverlay = styled.div`
  z-index: 100;
  position: absolute;
  top: 0; bottom: 0; left: 0; right: 0;
  background: rgba(0,0,0,0.9);
  color: white;
  & ._scroll {
    position: absolute;
    top: 0; bottom: 0; left: 0; right: 0;
    overflow-y: auto;
    padding: 4px 3px 0 6px;
  }
  & ._close {
    z-index: 1;
    margin: 4px;
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
const GridOverlayNotice = styled.div`
  height: 100%;
  display: flex;
  font-size: 1rem;
  flex-direction: column;
  & ._content {
    display: flex;
    align-items: center;
    flex-grow: 1;
    & > div {
      text-align: center;
      flex-grow: 1;
    }
  }
  & ._controls {
    margin-bottom: 6px;
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
        {portScan.processing && portScan.scanStart ? 
          `${portScan.host} portscan started ${moment(portScan.scanStart).from(new Date())}` :
          `portscan: ${fromNow(portScan.scanStart)} / ${fmtDuration(portScan.scanTime||0)}` 
        }
      </div>
    </GridHead>
);

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

const renderDevice = ({showPorts, hidePorts, state, props: p}, scan, data, loading) => {
  let ip = p.latestIp.ip;
  let beingScanned = p.isScanning && p.activeIp === ip;
  return (
    <GridItem>
      { state.showPorts && <PortsOverlay ports={p.ports} onHide={hidePorts} /> }
      <div className='mac'>
        { p.isSensor && 
          <Popup 
            trigger={<Icon name='eye' style={{float:'right'}} />} 
            content='pi-net-mon sensor'
          />
        }
        { p.isGateway && 
          <Popup 
            trigger={<Icon name='hdd' style={{float: 'right'}} />} 
            content='gateway' 
          />
        }
        { !p.isSensor && !p.isGateway && 
          <Popup
            trigger={<Icon name='asterisk' disabled={!p.isSpoof} style={{float: 'right'}} />}
            content={p.isSpoof ? 'arp spoofing on' : 'arp spoofing off, not monitoring traffic'}
          />
        }
        { p.mac }
      </div>
      <div className='ip'>
        { beingScanned ? <SlideLabel
              content={ip}
              label={'portscanning...'}
              color='#ff6c00'
            /> : ip
        } 
        { p.ports && p.ports.length > 0 && 
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
        { moment(p.latestIp.seen).from(new Date()) }
        { <Button 
          className="_scanButton"
          content='scan now' 
          size='mini' 
          loading={loading}
          disabled={loading || p.isScanning}
          style={{padding: '4px 6px', float: 'right'}}
          onClick={() => scan({ variables: {ip}})} 
        /> }
        { data && data.scan.scanError && <NoticeOverlay content={
          <span>
            <Icon name='warning' />
            { data.scan.scanError }
          </span>
        } />}
      </div>
    </GridItem>
  );
} 

class Device extends Component {
  state = { showPorts: false };
  showPorts = () => this.setState({ showPorts: !this.state.showPorts });
  hidePorts = () => this.setState({ showPorts: false });
  render() {return (
    <Mutation 
      mutation={SCAN}
      update={(cache, { data: {scan}}) => {
        const query = cache.readQuery({ query: DEVICES });
        query.spoofStatus = scan.spoofStatus;
        cache.writeQuery({
          query: DEVICES,
          data: query
        });
      }}
    >
      {(scan, {data, loading}) => renderDevice(this, scan, data, loading)}
    </Mutation>
  )};
}

const Overlay = ({onHide, children}) => (
  <GridOverlay>
    <Icon name='close' className='_close' onClick={onHide}/>
    <div className='_scroll'>
      { children }
    </div>
  </GridOverlay>
);

const PortsOverlay = ({ports, onHide}) => (
  <Overlay onHide={onHide} >
    <table style={{ fontSize: '0.8em' }}>
      <thead><tr><th>port</th><th>service</th><th>seen</th></tr></thead>
      <tbody>
      {ports.map(port => (
        <tr key={port.port}>
          <td>{port.port}</td>
          <td>{port.service}</td>
          <td>{fromNow(port.seen)}</td>
        </tr>
      ))}
      </tbody>
    </table>
  </Overlay>
);

class NoticeOverlay extends Component {
  state = { show: true };
  handleHide() {
    this.setState({ show: false });
  }
  render() { 
    const {content} = this.props;
    if (!this.state.show) { return null; }
    return (
      <Overlay onHide={this.handleHide.bind(this)}>
        <GridOverlayNotice>
          <div className='_content'><div>{content}</div></div>
          <Button 
            inverted
            className='_controls' 
            content='ok' 
            size='mini' 
            onClick={this.handleHide.bind(this)} 
          />
        </GridOverlayNotice>
      </Overlay>
    );
  }
} 

export default Devices;