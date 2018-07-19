import React, { Component } from "react";
import { Query, Mutation } from 'react-apollo';
import gql from 'graphql-tag';

import DashboardBro from './DashboardBro';

const Dashboard = () => (
  <div>
    <DashboardBro />
  </div>
);

export default Dashboard;