import React, { Component } from "react";
import { Redirect } from 'react-router-dom';
import styled from 'styled-components';
import { Button, Icon, Popup } from 'semantic-ui-react';
import moment from 'moment';

import { SPOOF_DEVICE, DEVICES } from './gql';
import Seen from './Seen';
import ScanControl from './ScanControl';
import SpoofControl from './SpoofControl';
import { green, gray, orange } from '../colors';

const Style = styled.div`
  position: relative;
  padding: 4px;
  cursor: pointer;
  .controls {
    display: none;
  }
  :hover {
    background: ${gray.lighten(0.8)};
    .controls {
      display: flex;
    }
  }
  .sub {
    font-size: 0.8em;
    line-height: 1.2em;
    margin-left: 2em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;
const Top = styled.div`
  display: flex;
  > div {
    flex-grow: 1;
    flex-basis: 32%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    &.last {
      text-align: right;
    }
  }
`;
const PortsStyle = styled.span`
  font-size: 0.9em;
  color: ${gray};
`;
const ControlsStyle = styled.div`
  display: flex;
  align-items: center;
  padding: 0 1em;
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  background: ${gray.darken(0.2)};
  > * + * {
    margin-left: 0.8em;
  }
`;

class DeviceItem extends Component {
  state = {};
  handleClick(e) {
    this.setState({ redirect: '/devices/' + this.props.mac });
  }
  render() {
    const p = this.props;
    const ip = p.latestIp;
    if (this.state.redirect) return <Redirect push to={this.state.redirect} />;
    return (
      <Style onClick={this.handleClick.bind(this)}>
        <Top>
          <div><Status {...p} /> {p.name || p.mac}</div>
          <div>{ip.ip} <Ports {...p} /></div>
          <div className='last'><Seen when={ip.seen} size='smaller' tip='last time seen on network' /></div>
        </Top>
        <div className='sub'>
          <Vendor {...p} />
          {p.name && ' ('+p.mac+')'} 
        </div>
        <Controls {...p} />
      </Style>
    );
  }
}

const Vendor = ({vendor}) => vendor || '(no vendor detected)';

const Status = ({latestIp, isGateway, isSensor, isSpoof, beingPortscanned}) => {
  const sinceSeen = Date.now() - (new Date(latestIp.seen)).getTime();
  let color = null;
  let tip = '';
  let special = null;
  !isSpoof && (special = 'dont');
  isGateway && (special = 'hdd');
  isSensor && (special = 'eye');
  !isSpoof && (tip = 'not monitoring, ');
  isGateway && (tip = 'gateway: ');
  isSensor && (tip = 'pi-net-mon: ');
  if (sinceSeen > 1000 * 60 * 40) {
    color = gray.lighten(0.5);
    tip += 'offline';
  } else {
    color = green();
    tip += 'online';
  }
  if (beingPortscanned) {
    color = orange();
    tip += ' - portscan in progress';
  }
  const trigger = <Icon name={special || 'circle'} style={{ color: color }} />;
  return <Popup
    trigger={trigger}
    content={tip}
    style={{ opacity: 0.9 }}
    inverted
  />;
}

const Ports = ({ports}) => (
  <PortsStyle>
    {ports.length > 0 && ports.map(p => p.port).join(', ') || '(no ports detected)'}
  </PortsStyle>
);

const Controls = p => (
  <ControlsStyle className='controls' onClick={e => e.stopPropagation()}>
    <ScanControl {...p} size='mini' />
    {!p.isGateway && !p.isSensor && <SpoofControl device={p} type='button' />}
  </ControlsStyle>
);

export default DeviceItem;