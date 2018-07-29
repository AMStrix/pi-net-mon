import React, { Component } from "react";
import ReactDOM from "react-dom";
import { Link } from 'react-router-dom';
import { graphql, Query, Mutation } from 'react-apollo';
import gql from 'graphql-tag';
import { List, Icon, Loader } from 'semantic-ui-react';
import moment from 'moment';
import styled from 'styled-components';

import { REMOTE_HOSTS } from './gql';
import { lightBlue, grayText } from '../colors';
import { isHostNewToday } from './util';
import Grid from './Grid';

const Style = styled.div`
  .hostWrap {
    white-space: nowrap;
    margin-bottom: 4px;
    line-height: 1.1rem;
    &.loading {
      background: ${grayText.lighten(0.7)};
    }
  }
  .host {
    font-weight: bold;
  }
  .newHost {
    font-weight: bold;
    background: ${lightBlue};
    display: inline-block;
    border-radius: 0.5em;
    padding: 0 0.5em;
  }
  .legend {
    float: right;
    font-size: 0.8em;
  }
  & a, & .when {
    font-size: 0.9em;
  }
  .when {
    color: gray;
    padding-left: 6px;
  }
  .scroll {
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
      {({loading, error, data: { remoteHosts } }) => {
        if (loading) return <Loading n={12} />;
        if (error) return `Error! ${error.message}`;
        return (
          <Style>
            <div>
              Recent Hosts
              <div className='legend newHost'>new today</div>
            </div>
            <hr />
            <div className='_middle scroll'>
              { remoteHosts.map(h => (
                <div className='hostWrap' key={h.host}>
                  <div className={isHostNewToday(h)?'newHost':'host'}>
                    {h.host}
                  </div>
                  <div>
                    <Link to={'/devices/'+h.latestMac} >{h.latestDeviceName||h.latestMac}</Link>
                    <span className='when'>
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

const Loading = ({n}) => (
  <Style>
    <div>
      Recent Hosts (loading...)
    </div>
    <hr />
    <div className='_middle scroll'>
      { _.range(n).map(i => (
        <div className='hostWrap loading' key={i}>
          <div className='host'>&nbsp;</div>
          <div><span className='when'>&nbsp;</span></div>
        </div>
      ))}
    </div>
  </Style>
);

export default DashboardRemoteHosts;