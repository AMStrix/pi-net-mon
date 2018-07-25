import React, { Component } from "react";
import { Query, Mutation } from 'react-apollo';
import gql from 'graphql-tag';
import { Route, Switch, Redirect, Link } from 'react-router-dom';
import styled from 'styled-components';
import { Button, Icon, Popup } from 'semantic-ui-react';
import moment from 'moment';

import { SPOOF_STATUS, SPOOF_DEVICE, DEVICES, SCAN } from './gql';
import Grid from './Grid';
import SlideLabel from './SlideLabel';
import Device from './Device';
import SpoofControl from './SpoofControl';

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

const Devices = ({ match: { url }}) => (
  <Query query={DEVICES} pollInterval={5000}>
    {({ loading, error, data }) => {
      if (loading) return "Loading...";
      if (error) return `Error! ${error.message}`;
      return (
        <Switch>
          <Route path={url + '/:mac'} component={Device} />
          <Route 
            path={url} 
            exact={true} 
            render={() => (
              <Grid>
                <SpoofStatus {...data.spoofStatus}/>
                {data.devices.map(d =>
                  <DeviceSummary 
                    key={d.mac} 
                    {...d} 
                    activeIp={data.spoofStatus.portScan.host}
                    isScanning={data.spoofStatus.portScan.processing}
                  />
                )}
              </Grid>
            )} 
          />
        </Switch>
      );
    }}
  </Query>
);


const SpoofStatus = ({pingSweep, portScan}) => (
    <Grid.Head>
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
    </Grid.Head>
);


class DeviceSummary extends Component {
  state = { showPorts: false };
  showPorts = () => this.setState({ showPorts: !this.state.showPorts });
  hidePorts = () => this.setState({ showPorts: false });
  render() {return renderDevice(this);}
}

const renderDevice = ({showPorts, hidePorts, state, props: p}) => {
  let ip = p.latestIp.ip;
  let beingScanned = p.isScanning && p.activeIp === ip;
  return (
    <Grid.Item>
      { state.showPorts && <PortsOverlay ports={p.ports} onHide={hidePorts} /> }
      <div className='_top'>
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
        { <Link to={'/devices/' + p.mac} >{p.mac}</Link> }
      </div>
      <div className='_top'>
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
      <div className='_middle' style={{ height: '60px' }} >
        {p.vendor || '(no vendor discovered)'}<br/>
        {p.os || '(os not detected)'}
      </div>
      <hr />
      <div className='_bottom'>
        <Icon name='clock' />
        { moment(p.latestIp.seen).from(new Date()) }
        <ScanControl {...p} />
        <SpoofControl device={p} type='button' style={{ float: 'right' }} errorContent={
          error => <NoticeOverlay content={<span><Icon name='warning' />{ error }</span>} />
        }/>
      </div>
    </Grid.Item>
  );
} 

const ScanControl = ({isScanning, latestIp: { ip }}) => (
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
  {(scan, {data, loading}) => (
    <span>
      <Button 
        content='scan now' 
        size='mini' 
        loading={loading}
        disabled={loading || isScanning}
        style={{padding: '4px 6px', float: 'right'}}
        onClick={() => scan({ variables: {ip}})} 
      />
      { data && data.scan.scanError && <NoticeOverlay content={
        <span>
          <Icon name='warning' />
          { data.scan.scanError }
        </span>
      } />} 
    </span> 
  )}
  </Mutation>
);

// const SpoofControl = ({isSpoof, latestIp: { ip }}) => (
//   <Mutation 
//     mutation={SPOOF_DEVICE}
//     update={(cache, { data: {spoofDevice}}) => {
//       const query = cache.readQuery({ query: DEVICES });
//       query.devices = spoofDevice.devices;
//       cache.writeQuery({
//         query: DEVICES,
//         data: query
//       });
//     }}
//   > 
//   {(spoofDevice, {data, loading}) => ( 
//     <span>
//       <Button 
//         content={isSpoof ? 'spoof: off' : 'spoof: on'} 
//         size='mini' 
//         loading={loading}
//         disabled={loading}
//         style={{padding: '4px 6px', float: 'right'}}
//         onClick={() => spoofDevice({ variables: { ip: ip, isSpoof: !isSpoof } })} 
//       />
//       { data && data.spoofDevice.spoofError && <NoticeOverlay content={
//         <span>
//           <Icon name='warning' />
//           { data.spoofDevice.spoofError }
//         </span>
//       } />} 
//     </span> 
//   )}
//   </Mutation>
// );

const Overlay = ({onHide, children}) => (
  <Grid.Overlay>
    <Icon name='close' className='_close' onClick={onHide}/>
    <div className='_scroll'>
      { children }
    </div>
  </Grid.Overlay>
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
        <Grid.Overlay.Notice>
          <div className='_content'><div>{content}</div></div>
          <Button 
            inverted
            className='_controls' 
            content='ok' 
            size='mini' 
            onClick={this.handleHide.bind(this)} 
          />
        </Grid.Overlay.Notice>
      </Overlay>
    );
  }
} 


export default Devices;