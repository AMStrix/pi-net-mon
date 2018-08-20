import React, { Component } from 'react';
import { Query } from 'react-apollo';
import styled from 'styled-components';

import { processDeviceHitsForChart } from './util';
import { DEVICE_HITS_24HR } from './gql';
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

const DeviceHostChart = p => (
  <Query query={DEVICE_HITS_24HR} variables={{ mac: p.mac, date: new Date() }}>
  {({loading, error, data}) => {
    if (loading) return 'Loading...';
    if (error) return `Error! ${error.message}`;
    const hits = processDeviceHitsForChart(data.deviceHits24hr);
    if (hits.sum === 0) return <Value small label='host activity' value='no host activity in last 24h' />;
    return (
      <Style>
        <h4>Host Activity</h4>
        <StackedTimeChart data={hits.data} />
        <PieWithLinksChart 
          data={hits.sums} 
          size={110} 
          label='24hr'
          makeLink={x => {
            if (x.rest) return `/hosts?sortField=latestHit&sortDir=-1&filter=${p.mac}`;
            return `/hosts/${x.k}`;
          }}
        />
      </Style>
    );
  }}
  </Query>
);

export default DeviceHostChart;