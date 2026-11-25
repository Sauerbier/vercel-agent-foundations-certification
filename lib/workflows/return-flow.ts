import { FatalError } from "workflow";
import {
  ApiRequestError,
  createReturn,
  notifyReturnInProcess,
  preauthorizeRefund,
} from "@/lib/api";

export interface ReturnRequest {
  orderId: string;
  reason: string;
  items: { productId: string; quantity: number }[];
}

// Each side effect is its own step. If a later step fails and retries, the
// workflow replays completed steps from the event log instead of re-running
// them, so the customer isn't emailed twice and the refund isn't
// pre-authorized twice.
export async function returnOrderWorkflow(request: ReturnRequest) {
  "use workflow";
  await notifyCustomer(request.orderId);
  const refund = await preauthorize(request.orderId);
  const filed = await fileReturn(request);
  return { returnId: filed.id, status: filed.status, refundPreauthorizationId: refund.id };
}

async function notifyCustomer(orderId: string) {
  "use step";
  await notifyReturnInProcess(orderId);
}

async function preauthorize(orderId: string) {
  "use step";
  try {
    return await preauthorizeRefund(orderId);
  } catch (err) {
    throw fatalOn4xx(err);
  }
}

async function fileReturn(request: ReturnRequest) {
  "use step";
  try {
    return await createReturn(request);
  } catch (err) {
    throw fatalOn4xx(err);
  }
}

function fatalOn4xx(err: unknown) {
  return err instanceof ApiRequestError && err.status >= 400 && err.status < 500
    ? new FatalError(err.message)
    : err;
}
