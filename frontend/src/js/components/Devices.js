import React, { Component } from "react";
import { Query } from 'react-apollo';
import { Route, Switch } from 'react-router-dom';
import styled from 'styled-components';
import { Icon, Popup } from 'semantic-ui-react';
import moment from 'moment';
import _ from 'lodash';

import { gray } from '../colors';
import { DEVICES } from './gql';
import DeviceItem from './DeviceItem';
import Device from './Device';

const Style = styled.div`
  margin: 8px 8px 0 8px;
  flex-grow: 1;
`;
const SpoofStatusStyle = styled.div`
  display: flex;
  justify-content: space-around;
  padding-bottom: 0.5em;
  margin-bottom: 0.5em;
  border-bottom: 1px solid ${gray.lighten(0.5)};
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

const Devices = ({ match: { url }}) => (
  <Switch>
    <Route path={url + '/:mac'} component={Device} />
    <Route 
      path={url} 
      exact={true} 
      render={() => (
        <Query query={DEVICES} pollInterval={5000}>
          {({ loading, error, data }) => {
            if (loading) return "Loading...";
            if (error) return `Error! ${error.message}`;
            let sorted = _.sortBy(data.devices, ['name']).reverse();
            sorted = _.sortBy(sorted, ['latestIp.seen']).reverse();
            return (
              <Style>
                <SpoofStatus {...data.spoofStatus}/>
                {sorted.map(d =>
                  <DeviceItem key={d.mac} {...d} />
                )}
              </Style>
            );
          }}
        </Query>
      )} 
    />
  </Switch>
);

const SpoofStatus = ({pingSweep, portScan}) => (
  <SpoofStatusStyle>
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
  </SpoofStatusStyle>
);

export default Devices;