import React, { Component } from "react";
import { Query, Mutation } from 'react-apollo';
import gql from 'graphql-tag';

import Grid from './Grid';
import DashboardBro from './DashboardBro';
import DashboardRemoteHosts from './DashboardRecentHosts';
import DashboardActiveHosts from './DashboardActiveHosts';

const Dashboard = () => (
  <Grid>
    <DashboardRemoteHosts />
    <DashboardActiveHosts />
    <DashboardBro />
  </Grid>
);

export default Dashboard;