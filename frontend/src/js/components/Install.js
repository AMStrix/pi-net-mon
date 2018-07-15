import React, { Component } from "react";
import ReactDOM from "react-dom";
import { Route, Switch, Redirect } from 'react-router-dom';
import styled from 'styled-components';
import { Button, Form, Header, Message, Segment, Step, Icon, Divider } from 'semantic-ui-react'

import CreateAdmin from './CreateAdmin';
import InstallBro from './InstallBro';

const Wrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 1;
`;

const Liner = styled.div`
  width: 600px;
`;

class Install extends Component {
  constructor() {
    super();
    this.state = {};
  }
  render() {
    let stepAdmin = !this.props.hasAdmin;
    let stepBro = !stepAdmin && !this.props.hasBro;
    let url = this.props.match.url;
    return (
      <Wrapper>
        <Liner>
          <Header as='h2' textAlign='left'>
            Install
          </Header>
          <div>
            <Step.Group attached='top'>
              <Step active={stepAdmin} completed={this.props.hasAdmin}>
                <Icon name='user' />
                <Step.Content>
                  <Step.Title>Create Admin</Step.Title>
                  <Step.Description>Create admin user credentials</Step.Description>
                </Step.Content>
              </Step>
              <Step active={stepBro} completed={this.props.hasBro}>
                <Icon name='eye' />
                <Step.Content>
                  <Step.Title>Install Bro</Step.Title>
                  <Step.Description>Install Bro IDS on your PI</Step.Description>
                </Step.Content>
              </Step>
            </Step.Group>
            <Segment attached='bottom'>
              <Switch>
                { !stepAdmin && stepBro && <Redirect to={url + '/bro'} /> }
                { !stepAdmin && !stepBro && <Redirect to='/dashboard' /> }
                <Route path={url + '/admin'} component={CreateAdmin} />
                { stepAdmin && <Redirect to={url + '/admin'} /> }
                <Route path={url + '/bro'} component={InstallBro} />
              </Switch>
            </Segment>
          </div>
        </Liner>
      </Wrapper>
    );
  }
}

export default Install;