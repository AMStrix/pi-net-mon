import React, { Component } from "react";
import { Query, Mutation } from 'react-apollo';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { Header, Icon, Dropdown, Pagination, Input } from 'semantic-ui-react';
import moment from 'moment';
import _ from 'lodash';

import { REMOTE_HOSTS_PAGE, DEVICES } from './gql';
import { lightBlue, grayText } from '../colors';

const Style = styled.div`

`;

const Host = ({match:{params:{host}}}) => (
  <Style>
    {host}
  </Style>
);

export default Host;