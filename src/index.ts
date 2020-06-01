import { forEachObjIndexed, map, pipe } from 'ramda'
import { validURL } from '@sidmonta/babelelibrary/build/tools'
import { getID } from '@sidmonta/babelelibrary/build/lods'
import { fetchSPARQL } from '@sidmonta/babelelibrary/build/stream'
import { filter } from 'rxjs/operators'

type URI = string
interface Quad {
  predicate?: { value?: string },
  subject?: { value?: string},
  object?: { value?: string}
}

const patternURI: (url: URI) => URI = pipe(
  (uri: URI) => new URL(uri),
  (url: URL) => url.origin + url.pathname
)

export default class Labeler {
  static store: Map<URI, string> = new Map<URI, string>()
  static history: Set<URI> = new Set<URI>()
  static proxy: string = ''

  public static async __(uri: URI, proxy: string = ''): Promise<string> {
    if (!validURL(uri)) {
      return Promise.resolve(uri)
    }

    if (Labeler.store.has(uri)) {
      return Promise.resolve(Labeler.store.get(uri) as string)
    }

    if (proxy) {
      Labeler.proxy = proxy
    }

    let uriForRequest = ''
    try {
      uriForRequest = Labeler.proxy + patternURI(uri)
    } catch (e) {
      Labeler.store.set(uri, uri)
      return Promise.resolve(uri)
    }

    const id = getID(uri) || uri
    try {
      return new Promise<string>(resolve => {
        fetchSPARQL(uriForRequest)
          .pipe(filter(
            (quad: Quad) => quad?.predicate?.value === 'http://www.w3.org/2000/01/rdf-schema#label'
          ))
          .subscribe(
            (quad: Quad) => { Labeler.store.set(quad?.subject?.value || '', quad?.object?.value || '') },
            _ => { Labeler.store.set(uri, id) && resolve(id) },
            () => { Labeler.history.add(uri) && resolve(Labeler.store.get(uri) || id) }
          )
      })
    } catch(e) {
      return Promise.resolve(id)
    }
  }

  public static prepopulate(obj: Record<URI, string>): void {
    forEachObjIndexed((value: string, key: URI) => {
      Labeler.store.set(key, value)
    }, obj)
  }

  public static async prefetch(urls: URI[], proxy: string = ''): Promise<void> {
    await pipe(
      map((url: URI) => Labeler.__(url, proxy)),
      urlsPromise => Promise.all(urlsPromise)
    )(urls)
  }

  public static async all(urls: URI[], proxy: string = ''): Promise<string[]> {
    return await pipe(
      map((url: URI) => Labeler.__(url, proxy)),
      urlsPromise => Promise.all(urlsPromise)
    )(urls)
  }
}
