import React, { Component } from "react";
import { Query, Mutation } from 'react-apollo';
import { Button } from 'semantic-ui-react';

import { SCAN, DEVICES } from './gql';

const ScanControl = ({
    size,
    style, 
    errorContent, 
    isScanning, 
    beingPortscanned,
    latestIp: { ip }
  }) => (
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
    <span style={style}>
      <Button 
        content='scan now' 
        size={size} 
        loading={loading || beingPortscanned}
        disabled={loading || isScanning}
        style={ size=='mini' && {padding: '4px 6px'} || {}}
        onClick={e => scan({ variables: {ip} })} 
      />
      { data && 
        data.scan.scanError && 
        errorContent && 
        errorContent(data.scan.scanError)
      } 
    </span> 
  )}
  </Mutation>
);

export default ScanControl;