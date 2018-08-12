import React, { Component } from "react";
import { Route, Switch, Redirect, Link } from 'react-router-dom';
import styled from 'styled-components';
import moment from 'moment';

import Grid from './Grid';
import HostSearch from './HostSearch';
import Host from './Host';

const Style = styled.div`
  width: 100%;
`;

const Hosts = ({ match: { url }}) => (
    <Switch>
      <Route path={url + '/:host' } component={Host} />
      <Route 
        path={url} 
        exact={true} 
        render={() => (
          <Grid>
            <Style>
              <HostSearch />
            </Style>
          </Grid>
        )} 
      />
    </Switch>
);

export default Hosts;