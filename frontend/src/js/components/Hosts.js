import React, { Component } from "react";
import { Query, Mutation } from 'react-apollo';
import gql from 'graphql-tag';
import { Route, Switch, Redirect, Link } from 'react-router-dom';
import styled from 'styled-components';
import { Button, Icon, Popup } from 'semantic-ui-react';
import moment from 'moment';

import Grid from './Grid';
import SlideLabel from './SlideLabel';
import Device from './Device';

const DEVICES = gql`
  query devices {
    devices {mac}
  }
`;

const Hosts = ({ match: { url }}) => (
  <Query query={DEVICES} pollInterval={5000}>
    {({ loading, error, data }) => {
      if (loading) return "Loading...";
      if (error) return `Error! ${error.message}`;
      return (
        <Switch>
          {/*<Route path={url + '/:host'} component={Host} />*/}
          <Route 
            path={url} 
            exact={true} 
            render={() => (
              <Grid>
                Hosts
              </Grid>
            )} 
          />
        </Switch>
      );
    }}
  </Query>
);



export default Hosts;