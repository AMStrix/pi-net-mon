import React, { Component } from "react";
import { Query, Mutation } from 'react-apollo';
import { Button } from 'semantic-ui-react';

import { SCAN, DEVICES } from './gql';

const ScanControl = ({isScanning, latestIp: { ip }}) => (
  <Mutation 
    mutation={SCAN}
    update={(cache, { data: {scan}}) => {
      const query = cache.readQuery({ query: DEVICES });
      query.spoofStatus = scan.spoofStatus;
      cache.writeQuery({
        query: DEVICES,
        data: query
      });
    }}
  > 
  {(scan, {data, loading}) => (
    <span>
      <Button 
        content='scan now' 
        size='mini' 
        loading={loading}
        disabled={loading || isScanning}
        style={{padding: '4px 6px', float: 'right'}}
        onClick={() => scan({ variables: {ip}})} 
      />
      { data && data.scan.scanError && <NoticeOverlay content={
        <span>
          <Icon name='warning' />
          { data.scan.scanError }
        </span>
      } />} 
    </span> 
  )}
  </Mutation>
);

export default ScanControl;