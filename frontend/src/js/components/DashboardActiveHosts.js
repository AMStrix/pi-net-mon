import React, { Component } from "react";
import ReactDOM from "react-dom";
import { Link } from 'react-router-dom';
import { graphql, Query, Mutation } from 'react-apollo';
import gql from 'graphql-tag';
import { List, Icon, Loader } from 'semantic-ui-react';
import moment from 'moment';
import styled from 'styled-components';

import Grid from './Grid';

const ACTIVE_HOSTS = gql`
  query activeHosts($period: String) {
    activeHosts(period: $period) {
      host
      hits
    }
  }
`;

const Style = styled.div`
  ._hostWrap {
    position: relative;
    white-space: nowrap;
    margin-bottom: 1px;
    margin-right: 0.5em;
    line-height: 1rem;
    & > span {
      position: relative;
      text-shadow: 0.5px 0.5px 1px white;
    }
    & > div {
      position: absolute;
      top: 1px;
      bottom: 1px;
      border-radius: 0 0.5em 0.5em 0;
      background: linear-gradient(to right, 
        rgba(118,166,255,0) 0%,
        rgba(118,166,255,0.2) 50%,
        rgba(118,166,255,1) 100%);
    }
  }
  ._host {
    font-weight: bold;
    width: 50%;
    display: inline-block;
    padding-left: 0.5em;
  }
  ._scroll {
    max-height: 400px;
    overflow-y: auto;
    margin-right: -8px; // todo: smarten
  }
`;

const sumLeaves = x => {
  if (typeof x === 'object') {
    return Object.keys(x).reduce((a, k) => a + sumLeaves(x[k]), 0);
  }
  return x;
}

const DashboardActiveHosts = () => (
  <Grid.Item>
    <Query 
      query={ACTIVE_HOSTS} 
      variables={{ period: '1h'}} 
      pollInterval={30000}
    >
      {({ loading, error, data: {activeHosts} }) => {
        if (loading) return "Loading...";
        if (error) return `Error! ${error.message}`;
        let hosts = activeHosts && activeHosts
                .map(h => [sumLeaves(JSON.parse(h.hits)), h])
                .sort((a, b) => b[0] - a[0]) || [];
        let max = hosts.length && hosts[0][0]; 
        let gw = hc => ((hc / max) * 100) + '%';
        return (
          <Style>
            <div>Active Hosts Today</div>
            <hr />
            <div className='_middle _scroll'>
              { !hosts.length && 'no active hosts' }
              { hosts
                .map(([hitCount, h]) => (
                  <div className='_hostWrap' key={h.host}>
                    <div style={{ width: gw(hitCount) }}>&nbsp;</div>
                    <span>{h.host}</span>
                  </div>
              ))}
            </div>
          </Style>
        );
      }}
    </Query>
  </Grid.Item>
);

export default DashboardActiveHosts;