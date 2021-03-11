import axios, { AxiosRequestConfig, AxiosResponse } from 'axios'

const jsonrpc = '2.0'

type TJsonRpcId = string | number

interface IResolvers<T, E> {
  resolve: (result: T) => void
  reject: (error: E) => void
}

export class JsonRpc {
  private mLastId = 0

  constructor(private urlApi: string) {
    //
  }

  public async call<T>(
    method: string,
    params: any[] = [], // eslint-disable-line @typescript-eslint/no-explicit-any
  ): Promise<T> {
    const id = this.generateId()

    return new Promise((resolve, reject) => {
      const resolvers: IResolvers<T, Error> = { resolve, reject }
      const headers = {
        'Content-Type': 'application/json',
      }
      const req: AxiosRequestConfig = {
        url: this.urlApi,
        method: 'POST',
        data: { method, jsonrpc, params, id },
        headers,
      }
      axios(req)
        .then((response) => this.handleResponse(response, resolvers))
        .catch((error) => this.handleError(error, resolvers))
    })
  }

  private handleError(
    err: Error,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { reject }: IResolvers<any, Error>,
  ) {
    reject(err)
  }

  private handleResponse<T>(res: AxiosResponse, { resolve }: IResolvers<T, Error>) {
    const result: T = res.data.result as T
    resolve(result)
  }

  private generateId(): TJsonRpcId {
    const id = ++this.mLastId
    if (10000 === this.mLastId) {
      this.mLastId = 0
    }
    return id
  }
}
