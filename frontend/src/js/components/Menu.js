import React, { Component } from "react";
import { Menu as SuiMenu } from 'semantic-ui-react';
import { NavLink } from 'react-router-dom';

const Menu = () => (
  <SuiMenu vertical inverted fixed='left' style={{overflowY: 'auto'}}>
    <SuiMenu.Item name='dashboard' as={NavLink} to='/' activeClassName='active' exact={true}>
      Dashboard
    </SuiMenu.Item>
    <SuiMenu.Item name='devices' as={NavLink} to='/devices' activeClassName='active'>
      Devices
    </SuiMenu.Item>
    <SuiMenu.Item name='hosts' as={NavLink} to='/hosts' activeClassName='active'>
      Hosts
    </SuiMenu.Item>
  </SuiMenu>
);

export default Menu;