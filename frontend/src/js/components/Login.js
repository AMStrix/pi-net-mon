import React, { Component } from "react";
import ReactDOM from "react-dom";
import { graphql, Mutation } from 'react-apollo';
import gql from 'graphql-tag';
import { Redirect } from 'react-router-dom';
import styled from 'styled-components';
import { Button, Form, Segment, Message, Header } from 'semantic-ui-react'

const Wrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
`;

const FormStyled = styled(Form)`
  width: 400px;
`;

const STATUS = gql`
  query Status {
    status {
      authed
    }
  }
`;

const LOGIN = gql`
  mutation login($user: String!, $pass: String!) {
    login(user: $user, pass: $pass) {
      authed,
      authError
    }
  }
`;

class Login extends Component {
  constructor(props) {
    super(props);
    this.state = {};
  }
  render() {
    return (
      <Wrapper>
        <Mutation
          mutation={LOGIN}
          update={(cache, { data: {login}}) => {
            const query = cache.readQuery({ query: STATUS });
            query.status.authed = login.authed;
            cache.writeQuery({
              query: STATUS,
              data: query
            });
          }}
        >
          {(login, { data }) => ( 
            <FormStyled size='large' error={data && data.login.authError ? true : false}>
              { this.props.authed && <Redirect to='/' /> }
              <Header as='h2' >Login</Header>
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
              <Button 
                primary
                fluid 
                size='large' 
                onClick={() => {
                  const { user, pass } = this.state;
                  login({ variables: { user, pass } });
                }}
                disabled={!(this.state.user && this.state.pass && 
                  (this.state.user && this.state.pass))}
              >
                Login
              </Button>
              <Message
                error
                content={data && data.login.authError}
              />
            </FormStyled>
          )}
        </Mutation>
      </Wrapper>
    );
  }
}



export default Login;