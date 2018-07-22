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
    white-space: nowrap;
    margin-bottom: 4px;
    line-height: 1.1rem;
  }
  ._subtle {
    color: gray;
  }
  ._host {
    font-weight: bold;
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

        return (
          <Style>
            <div>Active Hosts Today</div>
            <hr />
            <div className='_middle _scroll'>
              { !activeHosts && 'no active hosts' }
              { activeHosts && activeHosts
                .map(h => [sumLeaves(JSON.parse(h.hits)), h])
                .sort((a, b) => b[0] - a[0])
                .map(([hitCount, h]) => (
                <div className='_hostWrap' key={h.host}>
                  {h.host} {hitCount}
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