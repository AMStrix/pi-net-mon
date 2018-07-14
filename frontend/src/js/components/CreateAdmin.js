import React, { Component } from "react";
import ReactDOM from "react-dom";
import { graphql, Mutation } from 'react-apollo';
import gql from 'graphql-tag';
import { Button, Form, Segment, Message, Label, Icon } from 'semantic-ui-react'

const STATUS = gql`
  query Status {
    installStatus {
      hasAdmin
    }
  }
`;

const CREATE_ADMIN = gql`
  mutation createAdmin($user: String!, $pass: String!) {
    createAdmin(user: $user, pass: $pass)
  }
`;

class CreateAdmin extends Component {
  constructor(props) {
    super(props);
    this.state = {};
  }
  render() {
    return (
      <Mutation
        mutation={CREATE_ADMIN}
        update={(cache, { data: {createAdmin}}) => {
          const status = cache.readQuery({ query: STATUS });
          status.installStatus.hasAdmin = createAdmin ? false : true;
          cache.writeQuery({
            query: STATUS,
            data: status
          });
        }}
      >
        {(createAdmin, { data }) => (
          <Form size='large' error={data && data.createAdmin ? true : false}>
            <Form.Input 
              fluid 
              icon='user' 
              iconPosition='left' 
              placeholder='Username' 
              onChange={e => this.setState({ user: e.target.value })}
            />
            <Form.Input 
              fluid
              placeholder='Password'
              type='password'
              icon='lock'
              iconPosition='left'
              onChange={e => this.setState({ pass: e.target.value })}
            />
            <Form.Input
              fluid
              icon={ this.state.passCheck === this.state.pass ? 'check' : 'warning' }
              iconPosition='left'
              placeholder='Password (again)'
              type='password'
              onChange={e => this.setState({ passCheck: e.target.value })}
            />
            <Button 
              color='teal' 
              fluid 
              size='large' 
              onClick={() => {
                const { user, pass } = this.state;
                createAdmin({ variables: { user, pass } });
              }}
              disabled={!(this.state.user && this.state.pass && 
                (this.state.pass === this.state.passCheck))}
            >
              Create
            </Button>
            <Message
              error
              content={data && data.createAdmin || false}
            />
          </Form>
        )}
      </Mutation>
    );
  }
}



export default CreateAdmin;