import React, { Component } from "react";
import { Query, Mutation } from 'react-apollo';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { Header, Icon, Dropdown, Pagination, Input } from 'semantic-ui-react';
import moment from 'moment';
import _ from 'lodash';

import { REMOTE_HOST } from './gql';
import { lightBlue, grayText } from '../colors';
import Value from './Value';
import HostDeviceChart from './HostDeviceChart';

const Style = styled.div`
  margin: 8px 8px 0 8px;
`;

const research = [
  { 
    name: 'talosintelligence.com',
    isIp: true,
    isDomian: true,
    url: x => `https://www.talosintelligence.com/reputation_center/lookup?search=${x}`
  },
  {
    name: 'cymon.io',
    isDomian: true,
    url: dom => `https://cymon.io/domain/${dom}`
  },
  {
    name: 'cymon.io',
    isIp: true,
    url: ip => `https://cymon.io/${ip}`
  }
]

const Host = ({match:{params:{host}}}) => (
  <Style>
    <Value inline label='host' value={host} />
    <Query query={REMOTE_HOST} variables={{ host: host }} >
      {({loading, error, data}) => {
        if (loading) return 'Loading...';
        if (error) return `Error! ${error.message}`;
        const {remoteHost} = data;
        if (!remoteHost) return `Host ${host} not found.`;
        return (
          <div>
            <div>
              <Value inline small label='first seen' value={moment(remoteHost.birthday).calendar()} />
              <Value inline small label='last seen' value={moment(remoteHost.latestHit).calendar()} />
              <Value inline small label='sources'
                value={remoteHost.sources.join(', ')}
              />
            </div>
            <Value small label='research'
              value={ research.map(r => (
                  <div key={r.url()}>
                    <Icon name='flask' />
                    <a href={r.url(host)} target="_">{r.name}</a>
                  </div>
              ))}
            />
            <Value small label='devices'
              value={
                <div>
                {remoteHost.devices.map(d => (
                  <div key={d.id}><Link to={'/devices/' + d.id}>{d.name||d.mac}</Link></div>
                ))}
                </div>
              }
            />
            {remoteHost.assocHosts && <Value small label='associated'
              value={<div>{remoteHost.assocHosts.map(x => <div key={x} >{x}</div>)}</div>}
            />}
            <HostDeviceChart host={host} devices={remoteHost.devices} />
          </div>
        );
      }}
    </Query>
  </Style>
);

export default Host;