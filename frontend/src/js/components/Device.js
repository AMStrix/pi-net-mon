import React, { Component } from "react";
import ReactDOM from "react-dom";
import { graphql, Query, Mutation } from 'react-apollo';
import gql from 'graphql-tag';
import { List, Icon, Loader } from 'semantic-ui-react'

import Grid from './Grid';

const FULL_DEVICE = gql`
  fragment FullDevice on Device { 
    mac
    vendor
    os
    isSensor
    isGateway
    isSpoof
    latestIp { ip seen }
    ips { ip seen }
    ports {
      port
      protocol
      service
      seen
    }
  }
`;

const DEVICE = gql`
  query device($mac: String!) {
    device(mac: $mac) {
      ...FullDevice
    }
  }
  ${FULL_DEVICE}
`;

const Device = ({ match: { params: { mac }}}) => (
  <Grid>
    <Grid.Item full>
      Device { mac }
      <Query query={DEVICE} variables={{ mac: mac }}>
        {({loading, error, data}) => {
          if (loading) return 'Loading...';
          if (error) return `Error! ${error.message}`;
          return (
            <div>got device</div>
          );
        }}
      </Query>
    </Grid.Item>
  </Grid>
);

Device.FULL_DEVICE = FULL_DEVICE;

export default Device;