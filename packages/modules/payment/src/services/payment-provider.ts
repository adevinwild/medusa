import {
  BigNumberInput,
  CreatePaymentProviderSession,
  DAL,
  IPaymentProvider,
  Logger,
  PaymentProviderAuthorizeResponse,
  PaymentProviderDataInput,
  PaymentProviderError,
  PaymentProviderSessionResponse,
  PaymentSessionStatus,
  ProviderWebhookPayload,
  UpdatePaymentProviderSession,
  WebhookActionResult,
} from "@medusajs/framework/types"
import {
  isPaymentProviderError,
  MedusaError,
  ModulesSdkUtils,
} from "@medusajs/framework/utils"
import { PaymentProvider } from "@models"
import { EOL } from "os"

type InjectedDependencies = {
  logger?: Logger
  paymentProviderRepository: DAL.RepositoryService
  [key: `pp_${string}`]: IPaymentProvider
}

export default class PaymentProviderService extends ModulesSdkUtils.MedusaInternalService<InjectedDependencies>(
  PaymentProvider
) {
  #logger: Logger

  constructor(container: InjectedDependencies) {
    super(container)
    this.#logger = container["logger"]
      ? container.logger
      : (console as unknown as Logger)
  }

  retrieveProvider(providerId: string): IPaymentProvider {
    try {
      return this.__container__[providerId] as IPaymentProvider
    } catch (e) {
      const errMessage = `
      Unable to retrieve the payment provider with id: ${providerId}
      Please make sure that the provider is registered in the container and it is configured correctly in your project configuration file.
      `

      // Ensure that the logger captures the actual error
      this.#logger.error(e)

      throw new Error(errMessage)
    }
  }

  async createSession(
    providerId: string,
    sessionInput: CreatePaymentProviderSession
  ): Promise<PaymentProviderSessionResponse["data"]> {
    const provider = this.retrieveProvider(providerId)

    const paymentResponse = await provider.initiatePayment(sessionInput)

    if (isPaymentProviderError(paymentResponse)) {
      this.throwPaymentProviderError(paymentResponse)
    }

    return (paymentResponse as PaymentProviderSessionResponse).data
  }

  async updateSession(
    providerId: string,
    sessionInput: UpdatePaymentProviderSession
  ): Promise<Record<string, unknown> | undefined> {
    const provider = this.retrieveProvider(providerId)

    const paymentResponse = await provider.updatePayment(sessionInput)

    if (isPaymentProviderError(paymentResponse)) {
      this.throwPaymentProviderError(paymentResponse)
    }

    return (paymentResponse as PaymentProviderSessionResponse)?.data
  }

  async deleteSession(input: PaymentProviderDataInput): Promise<void> {
    const provider = this.retrieveProvider(input.provider_id)

    const error = await provider.deletePayment(input.data)
    if (isPaymentProviderError(error)) {
      this.throwPaymentProviderError(error)
    }
  }

  async authorizePayment(
    input: PaymentProviderDataInput,
    context: Record<string, unknown>
  ): Promise<{ data: Record<string, unknown>; status: PaymentSessionStatus }> {
    const provider = this.retrieveProvider(input.provider_id)

    const res = await provider.authorizePayment(input.data, context)
    if (isPaymentProviderError(res)) {
      this.throwPaymentProviderError(res)
    }

    const { data, status } = res as PaymentProviderAuthorizeResponse
    return { data, status }
  }

  async getStatus(
    input: PaymentProviderDataInput
  ): Promise<PaymentSessionStatus> {
    const provider = this.retrieveProvider(input.provider_id)
    return await provider.getPaymentStatus(input.data)
  }

  async capturePayment(
    input: PaymentProviderDataInput
  ): Promise<Record<string, unknown>> {
    const provider = this.retrieveProvider(input.provider_id)

    const res = await provider.capturePayment(input.data)
    if (isPaymentProviderError(res)) {
      this.throwPaymentProviderError(res)
    }

    return res as Record<string, unknown>
  }

  async cancelPayment(input: PaymentProviderDataInput): Promise<void> {
    const provider = this.retrieveProvider(input.provider_id)

    const error = await provider.cancelPayment(input.data)
    if (isPaymentProviderError(error)) {
      this.throwPaymentProviderError(error)
    }
  }

  async refundPayment(
    input: PaymentProviderDataInput,
    amount: BigNumberInput
  ): Promise<Record<string, unknown>> {
    const provider = this.retrieveProvider(input.provider_id)

    const res = await provider.refundPayment(input.data, amount)
    if (isPaymentProviderError(res)) {
      this.throwPaymentProviderError(res)
    }

    return res as Record<string, unknown>
  }

  async getWebhookActionAndData(
    providerId: string,
    data: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    const provider = this.retrieveProvider(providerId)

    return await provider.getWebhookActionAndData(data)
  }

  private throwPaymentProviderError(errObj: PaymentProviderError) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `${errObj.error}${errObj.detail ? `:${EOL}${errObj.detail}` : ""}`,
      errObj.code
    )
  }
}
