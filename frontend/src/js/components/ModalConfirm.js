import React, { Component } from 'react'
import { Button, Header, Icon, Modal } from 'semantic-ui-react'

export default class ModalConfirm extends Component {
  state = { modalOpen: false };

  handleOpen = () => this.setState({ modalOpen: true });

  handleClose = () => this.setState({ modalOpen: false });

  handleConfirm = () => {
    this.handleClose();
    this.props.onConfirm();
  };

  render() {
    return (
      <Modal
        trigger={
          <Button 
            size={this.props.buttonSize} 
            onClick={this.handleOpen}
            disabled={this.buttonDisabled}
          >
            {this.props.buttonContent}
          </Button>
        }
        open={this.state.modalOpen}
        onClose={this.handleClose}
        size='small'
      >
        <Header icon={this.props.headerIcon} content={this.props.headerContent} />
        <Modal.Content>
          <div>{this.props.content}</div>
        </Modal.Content>
        <Modal.Actions>
          <Button color='blue' onClick={this.handleConfirm}>
            Ok
          </Button>
          <Button onClick={this.handleClose}>
            Cancel
          </Button>
        </Modal.Actions>
      </Modal>
    );
  }
}