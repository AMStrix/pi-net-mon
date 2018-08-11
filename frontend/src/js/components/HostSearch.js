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
    margin-bottom: 10px;
    line-height: 1.2em;
  }
  .device, .latest {
    display: inline-block;
    margin-right: 0.6em;
    font-size: 0.9em;
    color: ${grayText.darken(0.2)}
  }
`;


class HostSearch extends Component {
  state = {
    sortField: 'host',
    sortDir: 1,
    skip: 0,
    limit: 50,
    hostSearch: undefined,
    filter: undefined
  };

  handlePageChange(skip) {
    this.setState({ skip: skip });
  }

  handleSort(sortBy) {
    const fToD = {
      host: 1,
      date: -1
    }
    this.setState({ 'sortField': sortBy, sortDir: fToD[sortBy]});
  }

  handleSearch(hostSearch) {
    this.setState({ hostSearch: hostSearch.length ? hostSearch : undefined });
  }

  handleFilter(mac) {
    this.setState({ filter: mac });
  }

  render() {
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
        variables={this.state} 
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
  handleKeyDown(e) {
    e.keyCode == 13 && this.search();
  }
  handleClick(e) {
    this.search();
  }
  search() {
    this.props.onSearch(this.inputRef.inputRef.value);
  }
  render() { return (
    <SearchControlsStyle>
      <Input 
        ref={x => this.inputRef = x}
        action={{ icon: 'search', onClick: this.search.bind(this) }} 
        placeholder='Search...' 
        onKeyDown={this.handleKeyDown.bind(this)}
      />
      <FilterControl {...this.props} />
      <SortControl {...this.props} />
    </SearchControlsStyle>
  );}
}

const FilterControl = p => (
  <Query query={DEVICES}> 
    {({loading, error, data: {devices}}) => {
      if (loading) return null;
      const sortedDevices = _.sortBy(devices, ['name', 'mac']);
      const filteredDev = _.find(devices, { mac: p.filter });
      const disp = filteredDev && (filteredDev.name||filteredDev.mac) || 'Device filter';
      const options = sortedDevices.map(d => ({
        key: d.mac,
        text: d.name || d.mac,
        value: d.mac,
        content: d.name || d.mac
      }));
      return (
        <Dropdown 
          text={disp} 
          icon='filter' 
          onChange={(e, o) => p.onFilter(o.value)}
          options={options}
          scrolling
        />
      )
    }}
  </Query>
);

const sortOptions = [
  { 
    key: 'host',
    text: 'host',
    value: 'host',
    content: 'Host'
  },
  {
    key: 'date',
    text: 'date',
    value: 'latestHit',
    content: 'Date'
  }
];
const sortKeyToDisp = k => _.find(sortOptions, { value: k }).content;
const SortControl = p => (
  <Dropdown 
    text={sortKeyToDisp(p.sortField)} 
    icon='sort'
    options={sortOptions}
    defaultValue={sortOptions[0].value}
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
      {_.take(p.hosts, p.limit/2).map(Item)}
    </div>
    <div className='col'>
      {_.drop(p.hosts, p.limit/2).map(Item)}
    </div>
  </ResultsStyle>
);

const Item = h => (
  <div key={h.host} className='item'>
    <div className='host'>{h.host}</div>
    <div className='sub'>
      <div className='latest'>{fmtLatest(h.latestHit)}</div>
      <div className='device'>
        <Link to={'/devices/'+h.latestMac} >{h.latestDeviceName||h.latestMac}</Link>
      </div>
    </div>
  </div>
);

export default HostSearch;