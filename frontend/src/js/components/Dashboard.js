import React, { Component } from "react";
import { Query, Mutation } from 'react-apollo';
import gql from 'graphql-tag';

import Grid from './Grid';
import DashboardBro from './DashboardBro';
import DashboardRemoteHosts from './DashboardRemoteHosts';

const Dashboard = () => (
  <Grid>
    <DashboardBro />
    <DashboardRemoteHosts />
  </Grid>
);

export default Dashboard;