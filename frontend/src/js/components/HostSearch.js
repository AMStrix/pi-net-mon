import React, { Component } from "react";
import { Query, Mutation } from 'react-apollo';
import { Link, Redirect } from 'react-router-dom';
import styled from 'styled-components';
import { Header, Icon, Dropdown, Pagination, Input } from 'semantic-ui-react';
import moment from 'moment';
import _ from 'lodash';

import { REMOTE_HOSTS_PAGE, DEVICES } from './gql';
import { lightBlue, grayText } from '../colors';

const Style = styled.div`
  margin: 16px;
`;

const SearchControlsStyle = styled.div`
  margin-bottom: 1em;
  > * {
    margin-right: 1em;
  }
`;

const PageControlsStyle = styled.div`
  margin: 1em 0;
  display: flex;
  justify-content: center;
`;

const ResultsStyle = styled.div`
  display: flex;
  justify-content: space-evenly;
  flex-wrap: wrap;
  .col {
    flex-grow: 1;
  }
  .item {
    display: block;
    color: black;
    margin-bottom: 10px;
    line-height: 1.2em;
    :hover {
      background: #eeeeee;
      cursor: pointer;
      .icon {
        visibility: visible;
      }
    }
    .icon {
      visibility: hidden;
    }
  }
  .device, .latest {
    display: inline-block;
    margin-right: 0.6em;
    font-size: 0.9em;
    color: ${grayText.darken(0.2)}
  }
`;

const SORT_OPTIONS = [
  { 
    key: 'host',
    text: 'Host Name',
    value: 'host',
    content: 'Host Name'
  },
  {
    key: 'latestHit',
    text: 'Latest Hit',
    value: 'latestHit',
    content: 'Latest Hit'
  }
];

const DEFAULT_STATE = [
  { k: 'sortField', v: 'host' },
  { k: 'sortDir', v: 1 },
  { k: 'skip', v: 0 },
  { k: 'limit', v: 50 },
  { k: 'hostSearch', v: undefined },
  { k: 'filter', v: 'all' }
];

const stateToQuery = (state, mod) => {
  const merged = Object.assign({}, state, mod);
  const genKV = (arr, k, dv, sv) => {
    (dv||sv) && arr.push(`${k}=${sv||dv}`);
    return arr;
  };
  const qs = '?' + DEFAULT_STATE.reduce((a, x) => genKV(a, x.k, x.v, merged[x.k]), []).join('&');
  return qs;
};

const queryToState = query => {
  const state = DEFAULT_STATE.reduce((a, x) => {
    a[x.k] = query[x.k] || x.v;
    return a;
  }, {});
  return state;
};

class HostSearch extends Component {
  state = {
    queryRedirect: undefined
  };
  componentWillMount() {
    this.setStateFromQuery();
  }
  componentDidUpdate(prevProps, prevState) {
    if (this.state.queryRedirect) {
      this.setState({ queryRedirect: undefined });
    }
    if (prevProps.query != this.props.query) {
      this.setStateFromQuery();
    }
  }
  setStateFromQuery() {
    const state = queryToState(this.props.query);
    this.setState(state);
  }
  setQueryRedirectFromState(newState) {
    const queryString = stateToQuery(this.state, newState);
    this.setState({ queryRedirect: queryString });
  }
  handlePageChange(skip) {
    this.setQueryRedirectFromState({ skip: skip });
  }
  handleSort(sortField) {
    const fToD = {
      host: 1,
      latestHit: -1
    }
    this.setQueryRedirectFromState({ 
      sortField: sortField, 
      sortDir: fToD[sortField] 
    });
  }
  handleSearch(hostSearch) {
    this.setQueryRedirectFromState({ 
      hostSearch: hostSearch.length ? hostSearch : undefined,
      skip: 0
    });
  }
  handleFilter(mac) {
    this.setQueryRedirectFromState({ filter: mac });
  }
  getRemoteHostsPageVars() {
    const vars = Object.assign({}, this.state);
    vars.filter == 'all' && (vars.filter = undefined);
    return vars;
  }
  render() {
    if (this.state.queryRedirect) return <Redirect push to={this.state.queryRedirect} />;
    return (
    <Style>
      <SearchControls 
        {...this.state}    
        onSearch={this.handleSearch.bind(this)}            
        onSort={this.handleSort.bind(this)}
        onFilter={this.handleFilter.bind(this)}
      />
      <Query 
        query={REMOTE_HOSTS_PAGE} 
        variables={this.getRemoteHostsPageVars()} 
      >
        {({loading, error, data: { remoteHostsPage } }) => {
          if (loading) return `Loading...`;
          if (error) return `Error! ${error.message}`;
          return (
            <div>
              <SearchResults 
                {...remoteHostsPage}
                {...this.state} 
              />
              <PageControls 
                {...remoteHostsPage} 
                {...this.state}
                onChange={this.handlePageChange.bind(this)}  
              />
            </div>
          );
        }}
      </Query>
    </Style>
    );
  }
}

class SearchControls extends Component {
  state = { input: '' };
  updateInputFromState() {
    this.setState({ input: this.props.hostSearch || '' });
  }
  componentWillMount() {
    this.updateInputFromState();
  }
  componentDidUpdate(prevProps, prevState) {
    if (prevProps.hostSearch != this.props.hostSearch) {
      this.updateInputFromState();
    }
  }
  handleKeyDown(e) {
    e.keyCode == 13 && this.search();
  }
  handleClick(e) {
    this.search();
  }
  search() {
    this.props.onSearch(this.state.input);
  }
  render() { 
    return (
      <SearchControlsStyle>
        <Input 
          action={{ icon: 'search', onClick: this.search.bind(this) }} 
          placeholder='Search...' 
          onKeyDown={this.handleKeyDown.bind(this)}
          value={this.state.input}
          onChange={e => this.setState({ input: e.target.value })}
        />
        <FilterControl {...this.props} />
        <SortControl {...this.props} />
      </SearchControlsStyle>
    );
  }
}

const FilterControl = p => (
  <Query query={DEVICES}> 
    {({loading, error, data: {devices}}) => {
      if (loading) return null;
      const sortedDevices = _.sortBy(devices, ['name', 'mac']);
      const options = [{ 
        key: 'all', 
        text: 'All', 
        value: 'all', 
        content: 'All'
      }].concat(sortedDevices.map(d => ({
        key: d.mac,
        text: d.name || d.mac,
        value: d.mac,
        content: d.name || d.mac
      })));
      return (
        <Dropdown
          button
          labeled
          className='icon' 
          icon='filter' 
          options={options}
          value={p.filter}
          onChange={(e, o) => p.onFilter(o.value)}
          scrolling
        />
      )
    }}
  </Query>
);

const SortControl = p => (
  <Dropdown
    button
    labeled
    className='icon' 
    icon='sort'
    options={SORT_OPTIONS}
    value={p.sortField}
    onChange={(e, o) => p.onSort(o.value)}
  />
);

const PageControls = p => (
  <PageControlsStyle>
    <Pagination
      activePage={(p.skip + p.limit) / p.limit}
      boundaryRange={1}
      onPageChange={(e, pevt) => {
        p.onChange((pevt.activePage - 1) * p.limit);
      }}
      siblingRange={1}
      totalPages={Math.ceil(p.count / p.limit)}
    />
  </PageControlsStyle>
);

const fmtLatest = date => moment(date).format('YYYY/M/D H:mm');

const SearchResults = p => (
  <ResultsStyle>
    <div className='col'>
      {_.take(p.hosts, p.limit/2).map(h => <Item key={h.host} {...h} />)}
    </div>
    <div className='col'>
      {_.drop(p.hosts, p.limit/2).map(h => <Item key={h.host} {...h} />)}
    </div>
  </ResultsStyle>
);

class Item extends Component {
  state = {}
  render() {
    if (this.state.redirect) return <Redirect push to={this.state.redirect} />;
    return (
      <div onClick={() => this.setState({ redirect: '/hosts/' + this.props.host })} className='item'>
        <div className='host'>
          {this.props.host}
          <Icon className='icon' name='angle right' />
        </div>
        <div className='sub'>
          <div className='latest'>{fmtLatest(this.props.latestHit)}</div>
          <div className='device'>
            <Link to={'/devices/'+this.props.latestMac} >{this.props.latestDeviceName||this.props.latestMac}</Link>
          </div>
        </div>
      </div> 
    );   
  }
}

export default HostSearch;