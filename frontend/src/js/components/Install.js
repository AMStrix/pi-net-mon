import React, { Component } from "react";
import ReactDOM from "react-dom";
import { Route, Switch, Redirect } from 'react-router-dom';
import { Button, Form, Grid, Header, Message, Segment, Step, Icon, Divider } from 'semantic-ui-react'

import CreateAdmin from './CreateAdmin';
import InstallBro from './InstallBro';

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
      <div style={{ height: '100%' }}>
        <Grid textAlign='center' style={{ height: '100%' }} verticalAlign='middle'>
          <Grid.Column style={{ maxWidth: 600 }} textAlign='left'>
            <Header as='h2' textAlign='center'>
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
          </Grid.Column>
        </Grid>
      </div>
    );
  }
}

export default Install;