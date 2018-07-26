import React, { Component } from "react";
import ReactDOM from "react-dom";
import { Link } from 'react-router-dom';
import { graphql, Query, Mutation } from 'react-apollo';
import gql from 'graphql-tag';
import { List, Icon, Loader } from 'semantic-ui-react';
import moment from 'moment';
import styled from 'styled-components';

import { REMOTE_HOSTS } from './gql';
import { lightBlue } from '../colors';
import { isHostNewToday } from './util';
import Grid from './Grid';

const Style = styled.div`
  ._hostWrap {
    white-space: nowrap;
    margin-bottom: 4px;
    line-height: 1.1rem;
  }
  ._host {
    font-weight: bold;
  }
  ._newHost {
    font-weight: bold;
    background: ${lightBlue};
    display: inline-block;
    border-radius: 0.5em;
    padding: 0 0.5em;
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
    overflow-x: hidden;
  }
`;

const DashboardRemoteHosts = () => (
  <Grid.Item>
    <Query 
      query={REMOTE_HOSTS} 
      variables={{ sortField: 'latestHit', sortDir: -1, skip: 0, limit: 200 }} 
      pollInterval={30000}
    >
      {({ loading, error, data: {remoteHosts} }) => {
        if (loading) return "Loading...";
        if (error) return `Error! ${error.message}`;

        return (
          <Style>
            <div>
              Recent Hosts
              <div className='_newHost' style={{ float: 'right', fontSize: '0.8em' }}>new today</div>
            </div>
            <hr />
            <div className='_middle _scroll'>
              { remoteHosts.map(h => (
                <div className='_hostWrap' key={h.host}>
                  <div className={isHostNewToday(h)?'_newHost':'_host'}>
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