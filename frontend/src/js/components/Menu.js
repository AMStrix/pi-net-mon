import React, { Component } from "react";
import { Query } from 'react-apollo';
import { Menu as SuiMenu, Label } from 'semantic-ui-react';
import { NavLink } from 'react-router-dom';

import { ALERT_COUNT } from './gql';
import { red } from '../colors';

const Menu = () => (
  <SuiMenu vertical inverted fixed='left' style={{overflowY: 'auto'}}>
    <SuiMenu.Item name='dashboard' as={NavLink} to='/' activeClassName='active' exact={true}>
      Dashboard
    </SuiMenu.Item>
    <SuiMenu.Item name='alerts' as={NavLink} to='/alerts' activeClassName='active' exact={true}>
      <AlertCount />
      Alerts
    </SuiMenu.Item>
    <SuiMenu.Item name='devices' as={NavLink} to='/devices' activeClassName='active' exact={true}>
      Devices
    </SuiMenu.Item>
    <SuiMenu.Item name='hosts' as={NavLink} to='/hosts' activeClassName='active' exact={true}>
      Hosts
    </SuiMenu.Item>
    <SuiMenu.Item name='feeds' as={NavLink} to='/feeds' activeClassName='active'>
      Feeds
    </SuiMenu.Item>
  </SuiMenu>
);

const AlertCount = () => (
  <Query query={ALERT_COUNT} variables={{ level: 5 }} pollInterval={30000}>
    {({loading, error, data}) => { 
      if (loading) return null;
      if (error) return null;
      if (data.alertCount === 0) return null;
      return <Label style={{ background: red.darken(0.2) }}>{data.alertCount}</Label>;
    }}
  </Query>
);

export default Menu;