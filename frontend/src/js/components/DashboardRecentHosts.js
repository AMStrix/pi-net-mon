import React, { Component } from "react";
import ReactDOM from "react-dom";
import { Link } from 'react-router-dom';
import { graphql, Query, Mutation } from 'react-apollo';
import gql from 'graphql-tag';
import { List, Icon, Loader } from 'semantic-ui-react';
import moment from 'moment';
import styled from 'styled-components';

import Grid from './Grid';

const REMOTE_HOSTS = gql`
  query remoteHosts($sortField: String, $sortDir: Int, $skip: Int, $limit: Int) {
    remoteHosts(sortField: $sortField, sortDir: $sortDir, skip: $skip, limit: $limit) {
      host
      latestHit
      latestMac
      assocHost
      sources
      protocols
      services
      macs
    }
  }
`;

const DEPLOY = gql`
  mutation deploy {
    deployBro {
      isDeployed
      status
      errors
    }
  }
`;

const Style = styled.div`
  ._hostWrap {
    white-space: nowrap;
    margin-bottom: 4px;
    line-height: 1.1rem;
  }
  ._host {
    font-weight: bold;
  }
  & a, & ._when {
    font-size: 0.9em;
  }
  ._when {
    color: gray;
    padding-left: 6px;
  }
  ._scroll {
    max-height: 400px;
    overflow-y: auto;
    margin-right: -8px; // todo: make Grid.Scrollable or sth.
  }
`;

const DashboardRemoteHosts = () => (
  <Grid.Item>
    <Query 
      query={REMOTE_HOSTS} 
      variables={{ sortField: 'latestHit', sortDir: -1, skip: 0, limit: 20 }} 
      pollInterval={30000}
    >
      {({ loading, error, data: {remoteHosts} }) => {
        if (loading) return "Loading...";
        if (error) return `Error! ${error.message}`;

        return (
          <Style>
            <div>Recent Hosts</div>
            <hr />
            <div className='_middle _scroll'>
              { remoteHosts.map(h => (
                <div className='_hostWrap' key={h.host}>
                  <div className='_host'>
                    {h.host}
                  </div>
                  <div>
                    <Link to={'/devices/'+h.latestMac} >{h.latestMac}</Link>
                    <span className='_when'>
                      {moment(h.latestHit).from(new Date())}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Style>
        );
      }}
    </Query>
  </Grid.Item>
);

export default DashboardRemoteHosts;