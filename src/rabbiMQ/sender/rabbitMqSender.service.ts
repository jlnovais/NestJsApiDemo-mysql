import { connect, Channel, ChannelModel } from 'amqplib';

import {
  LoggerWrapper,
  RabbitMqConnectionDetailsSender,
} from '../commom/types';
import { WriteLog } from '../commom/utils';
import { RabbitResult } from '../commom/rabbitResult';
//import logger from '../../../config/logger';

export class RabbitMqSenderService {
  private model: ChannelModel | null = null;
  private channel: Channel | null = null;
  private rabbitmqUrl: string;
  private isConnecting: boolean = false;
  private connectionDetails: RabbitMqConnectionDetailsSender;
  private currentHostIndex: number = 0;
  private currentHost: string | null = null;

  private _logger: LoggerWrapper | null = null;

  //private connectionRetryDelay: number = 5000; // Default to 5 seconds;
  private currentConnectionRetryAttempt: number = 0;

  /**
   * Constructs a new instance of the MessageBrokerService.
   * @param connectionDetails The connection details for the RabbitMQ server.
   */
  constructor(
    connectionDetails: RabbitMqConnectionDetailsSender,
    logger: LoggerWrapper | null = null,
  ) {
    this._logger = logger;

    this.connectionDetails = connectionDetails;

    this.rabbitmqUrl = this.buildRabbitMqUrl(this.connectionDetails);

    //logger.warn(`conneccting to RabbitMQ... ${JSON.stringify(this.connectionDetails)}`);
  }

  // format: amqp://<user>:<password>@<host>:<port>/<vhost>

  /**
   * Builds the RabbitMQ connection URL from the provided connection details.
   * @param details The connection details for the RabbitMQ server.
   * @returns The fully constructed RabbitMQ connection URL string.
   */
  private buildRabbitMqUrl(details: RabbitMqConnectionDetailsSender): string {
    const { hostname, port, username, password, vhost } = details;

    const hostDetails = this.getHostnameFromListOfHosts(
      hostname,
      details.selectRandomHost,
      details.selectSequencialHost,
    );

    this.currentHost = hostDetails.host;

    let url = 'amqp://';

    // Add user and password if they exist
    if (username) {
      url += encodeURIComponent(username);
      // A password can be an empty string
      if (password !== undefined) {
        url += `:${encodeURIComponent(password)}`;
      }
      url += '@';
    }

    url += hostDetails.host;

    // Add port if it exists
    if (port) {
      url += `:${port}`;
    }

    // Add vhost if it exists. An empty string for vhost is equivalent to '/'.
    // If undefined, the broker default is used.
    if (vhost !== undefined) {
      url += vhost.startsWith('/') ? vhost : `/${vhost}`;
    }

    return url;
  }

  /**
   * Selects a hostname from a comma-separated list of hosts based on the selection strategy.
   * @param listOfHosts A comma-separated string of hostnames.
   * @param selectRandom If true, selects a random host from the list. Defaults to true.
   * @param selectSequencial If true, selects hosts sequentially from the list. Defaults to false.
   * @returns An object containing the selected host and its index in the list.
   */
  private getHostnameFromListOfHosts(
    listOfHosts: string,
    selectRandom: boolean = true,
    selectSequencial: boolean = false,
  ): { host: string; index: number } {
    if (!listOfHosts) {
      throw new Error('RabbitMQ hostname is required to build the URL.');
    }

    const hosts = listOfHosts
      .replaceAll(';', ',')
      .split(',') // alternativa: .split(/[,;]/) neste caso já nao seria necessário o replaceAll
      .map((host) => host.trim())
      .filter((host) => host.length > 0);

    /*
        console.log(`------------------------------------`);
        console.log(`listOfHosts: ${listOfHosts}`);
        console.log(`hosts: ${JSON.stringify(hosts)}`);
        console.log(`------------------------------------`);
*/

    if (hosts.length === 0) {
      throw new Error('No RabbitMQ hosts provided in the list.');
    }

    if (hosts.length === 1) {
      this.currentHostIndex = 0;
      this.currentHost = hosts[0];
      return { host: hosts[0], index: 0 };
    }

    if (selectRandom) {
      const randomIndex = Math.floor(Math.random() * hosts.length);
      const randomItem = hosts[randomIndex];
      this.currentHostIndex = randomIndex;
      this.currentHost = randomItem;
      return { host: randomItem, index: randomIndex };
    }

    if (selectSequencial) {
      this.currentHost = hosts[this.currentHostIndex];
      const hostDetails = {
        host: hosts[this.currentHostIndex],
        index: this.currentHostIndex,
      };
      this.currentHostIndex = (this.currentHostIndex + 1) % hosts.length;
      return hostDetails;
    }
    // Default to the first host if no selection strategy is provided
    this.currentHostIndex = 0;

    return { host: hosts[0], index: 0 };
  }

  /**
   * Establishes a connection to the RabbitMQ server and creates a channel.
   * Includes retry logic in case of initial connection failure.
   */
  public async connect(): Promise<void> {
    if (this.model || this.isConnecting) {
      return;
    }
    this.isConnecting = true;

    try {
      const properties = {
        clientProperties: {
          connection_name:
            this.connectionDetails.connectionDescription ||
            'Default Connection', // This will show up in the RabbitMQ UI
          // You can add other custom properties here as well
          CustomDetailsDefinedInTheApp:
            'propriedade definida na app, quer o nome, quer o valor', // Example of a custom property,
        },
        timeout: this.connectionDetails.connectionTimeout || 10000, // Default to 10 seconds
      };

      this.model = await connect(this.rabbitmqUrl, properties);
      this.channel = await this.model.createChannel();

      WriteLog(
        this._logger,
        'info',
        `Successfully connected to RabbitMQ. Host: ${this.currentHost}`,
      );

      this.currentConnectionRetryAttempt = 0;

      this.model.on('error', (err: Error) => {
        WriteLog(
          this._logger,
          'error',
          `RabbitMQ connection error. Host: ${this.currentHost} | Error: ${err.message}`,
          { error: err },
        );
        this.handleDisconnect();
      });

      this.model.on('close', () => {
        WriteLog(
          this._logger,
          'warn',
          `RabbitMQ connection closed. Host: ${this.currentHost} | Attempting to reconnect... `,
        );
        this.handleDisconnect();
      });
    } catch (error) {
      WriteLog(
        this._logger,
        'error',
        `Failed to connect to RabbitMQ. Host: ${this.currentHost} | Retrying... `,
      );
      WriteLog(this._logger, 'error', 'RabbitMQ connection error', {
        error: error as Error,
      });

      this.handleDisconnect();
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Sends a message to a specified queue.
   * Ensures the queue exists before sending.
   * @param queue The name of the queue.
   * @param message The message object to send.
   * @returns True if the message was sent successfully, false otherwise.
   */
  public async sendMessageQueue(
    queue: string,
    message: object,
  ): Promise<boolean> {
    if (!this.channel) {
      WriteLog(
        this._logger,
        'error',
        'Cannot send message, RabbitMQ channel is not available.',
      );
      return false;
    }

    try {
      // Assert the queue exists, and if not, create it.
      // 'durable: true' ensures the queue survives a broker restart.
      await this.channel.assertQueue(queue, { durable: true });
      // Send the message to the specified queue
      this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
        persistent: true, // The message will be persisted to disk
      });
      WriteLog(this._logger, 'info', `Message sent to queue "${queue}"`);

      return true;
    } catch (error) {
      WriteLog(
        this._logger,
        'error',
        `Error sending message to queue "${queue}"`,
        { error: error as Error },
      );

      return false;
    }
  }

  /**
   * Sends a message to an exchange with a specific routing key.
   * @param queueNameOrRoutingKey The name of the queue or the routing key for the message.
   * @param exchangeName The name of the exchange to publish the message to.
   * @param message The message to be sent. Can be any object.
   * @returns A Result object indicating the success or failure of the operation.
   */
  public sendMessage(
    queueNameOrRoutingKey: string,
    exchangeName: string,
    message: any,
  ): RabbitResult {
    const result = new RabbitResult();
    if (!this.channel) {
      result.Success = false;
      result.ErrorCode = 500;
      result.ErrorDescription = 'Not connected to RabbitMQ';
      return result;
    }

    try {
      console.log(
        'queue service | queueNameOrRoutingKey:',
        queueNameOrRoutingKey,
      );
      console.log('queue service | exchangeName:', exchangeName);

      if (!queueNameOrRoutingKey && !exchangeName) {
        result.Success = false;
        result.ErrorCode = 400;
        result.ErrorDescription =
          'Queue name or routing key and exchange name must be provided';
        return result;
      }

      /*
            if (!queueNameOrRoutingKey && exchangeName) {
                result.Success = false;
                result.ErrorCode = 400;
                result.ErrorDescription = 'Queue name or routing key must be provided when exchange name is specified';
                return result;
            }

            if (queueNameOrRoutingKey && !exchangeName) {
                // send to a queue directly
                exchangeName = ''; // Default to empty if not provided
            }
                */

      // Publish the message to the exchange with the specified routing key
      this.channel.publish(
        exchangeName,
        queueNameOrRoutingKey,
        Buffer.from(JSON.stringify(message)),
        { persistent: true },
      );
      result.Success = true;
    } catch (err) {
      result.Success = false;
      result.ErrorCode = 500;
      result.ErrorDescription = `Failed to send message: ${err}`;
    }
    return result;
  }
  /**
   * Handles disconnection by resetting state and attempting to reconnect.
   */
  private handleDisconnect() {
    this.channel = null;
    this.model = null;

    if (
      this.connectionDetails.connectionRetryAttempts === 0 ||
      this.connectionDetails.connectionRetryDelay <= 0
    ) {
      WriteLog(
        this._logger,
        'warn',
        `No retry attempts configured or retry delay is less than or equal to zero. Not attempting to reconnect.`,
      );
      this.isConnecting = false;
      return;
    }

    if (this.connectionDetails.connectionRetryAttempts > 0) {
      this.currentConnectionRetryAttempt++;
      if (
        this.currentConnectionRetryAttempt >
        this.connectionDetails.connectionRetryAttempts
      ) {
        WriteLog(
          this._logger,
          'error',
          `Max connection retry attempts reached (${this.connectionDetails.connectionRetryAttempts}). Stopping retries.`,
        );
        this.isConnecting = false;
        return;
      }

      WriteLog(
        this._logger,
        'warn',
        `Retrying connection to RabbitMQ in ${this.connectionDetails.connectionRetryDelay}ms... Attempt ${this.currentConnectionRetryAttempt} of ${this.connectionDetails.connectionRetryAttempts}`,
      );
    }

    setTimeout(() => {
      // Rebuild the RabbitMQ URL in case the host has changed
      this.rabbitmqUrl = this.buildRabbitMqUrl(this.connectionDetails);
      void this.connect();
    }, this.connectionDetails.connectionRetryDelay);
  }
}
