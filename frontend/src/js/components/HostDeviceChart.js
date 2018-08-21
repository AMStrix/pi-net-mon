import React, { Component } from 'react';
import { Query } from 'react-apollo';
import styled from 'styled-components';

import { processHostHitsForChart } from './util';
import { HOST_HITS_24HR } from './gql';
import Value from './Value';
import StackedTimeChart from './StackedTimeChart';
import PieWithLinksChart from './PieWithLinksChart';

const Style = styled.div`
  h4 {
    position: relative;
    z-index: 1;
    margin-bottom: -1em;
    text-shadow: 0.5px 0.5px 2px #ffffff;
  }
`;

const HostDeviceChart = p => (
  <Query query={HOST_HITS_24HR} variables={{ host: p.host, date: new Date() }}>
  {({loading, error, data}) => {
    if (loading) return 'Loading...';
    if (error) return `Error! ${error.message}`;
    const hits = processHostHitsForChart(data.hostHits24hr);
    if (hits.sum === 0) return <Value small label='host activity' value='no host activity in last 24h' />;
    return (
      <Style>
        <h4>Activity</h4>
        <StackedTimeChart data={hits.data} />
        <PieWithLinksChart 
          data={hits.sums} 
          size={110} 
          label='24hr'
          makeLink={x => {
            return `/devices/${x.k}`;
          }}
          makeLinkLabel={x => {
            const dev = _.find(p.devices, { mac: x.k })
            return dev && dev.name || dev.mac;
          }}
        />
      </Style>
    );
  }}
  </Query>
);

export default HostDeviceChart;