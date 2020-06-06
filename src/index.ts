import { concat, contains, forEachObjIndexed, ifElse, map, pipe, identity } from 'ramda'
import { validURL } from '@sidmonta/babelelibrary/build/tools'
import { getID } from '@sidmonta/babelelibrary/build/lods'
import { fetchSPARQL } from '@sidmonta/babelelibrary/build/stream'
import { filter } from 'rxjs/operators'

/**
 * Alias per distiguere un URI
 * @alias string
 */
type URI = string

/**
 * Descrizione sintetica per una Tripla utile per non dover utilizzare per questo progetto il pacchetto n3
 * @interface
 */
interface Quad {
  predicate?: { value?: string },
  subject?: { value?: string },
  object?: { value?: string, language?: string }
}

/**
 * Estrapola da un URI solo il riferimento al servizio della risorsa, non alla risorsa stessa.
 * Questo metodo lo utilizzo per estrarre direttamente tutta l'ontologia così con una sola chiamata estrapolo tutte le
 * label associate e risparmio chiamate al server dove risiede l'ontologia
 *
 * @param url indirizzo del subject da cui estrarre l'ontologia
 * @return L'indirizzo dell'ontologia
 * @function
 */
const patternURI: (url: URI) => URI = pipe(
  (uri: URI) => new URL(uri), // Trasformo l'uri in una URL
  (url: URL) => url.origin + url.pathname // Estrapolo dall'URL solo host e il path iniziale,
  // senza ancore o parametri
)

/**
 * @class
 *
 */
export default class Labeler {
  /**
   * @static
   * @property {Map<URI, string>} store - Istanzia una cache che registra le label di volta in volta trovate.
   * Per risparmiare tempo e chiamate a server esterni, salva in cache le label e le ritorna immediatamente se presenti
   */
  static store: Map<URI, string> = new Map<URI, string>()

  /**
   * Salva l'indirizzo da utilizzare come proxy, qualora fosse necessario
   */
  static proxy: string = ''

  /**
   * Ricerca la label associata alla risorsa LOD e la ritorna.
   *
   * @static
   * @memberOf Labeler
   * @async
   *
   * @param {URI} uri URI della risorsa LOD di cui cercare la label
   * @param {string} lang lingua di definizione della label
   * @param {string} [proxy] qual'ora la ricerca necessiti di un proxy per la ricerca
   * @return {Promise<string>} Ritorna una Promise contenente la label associata alla risorsa
   */
  public static async __ (uri: URI, lang: string = '', proxy: string = ''): Promise<string> {
    // Controllo se l'URI della risorsa sia valida, se non lo è la ritorno come se fosse essa stessa la label
    if (!validURL(uri)) {
      return Promise.resolve(uri)
    }

    // Se ho già cachato la label della risorsa la ritorno senza fare chiamate.
    if (Labeler.store.has(uri)) {
      return Promise.resolve(Labeler.store.get(uri) as string)
    }

    // Se ho settato un proxy, lo salvo per le chiamate successive
    if (proxy) {
      Labeler.proxy = proxy
    }

    // Trasformo l'URI nell'indirizzo dell'ontologia che descrive la risorsa
    // L'operazione può fallire (URL API), in tal caso ritorno come label l'indirizzo della risorsa
    let uriForRequest = ''
    try {
      // Genero l'indirizzo dell'ontologia e ci appendo l'indirizzo del proxy
      // In sostanza se nell'URI è presente il cancelletto vuol dire che il solo url punta direttamente all'intera
      // ontologia per velocizzare il reperimento in un'unica chiamata di tutte le sue label
      uriForRequest = ifElse(contains('#'), pipe(patternURI, concat(Labeler.proxy)), identity)(uri)
    } catch (e) {
      Labeler.store.set(uri, uri)
      return Promise.resolve(uri)
    }

    // Recupero l'identificativo della risorsa
    const id = getID(uri) || uri
    try {
      return new Promise<string>(resolve => {
        // Eseguo la chiamata all'ontologia
        fetchSPARQL(uriForRequest)
          .pipe(filter( // Filtro le sole triple che riportano la label delle risorse
            (quad: Quad) => quad?.predicate?.value === 'http://www.w3.org/2000/01/rdf-schema#label'
            && (!lang || quad.object?.language === lang)
          ))
          .subscribe(
            // Salvo ogni tripla nella cache
            (quad: Quad) => { Labeler.store.set(quad?.subject?.value || '', quad?.object?.value || '') },
            // Se la chiamata all'ontologia fallisce, salvo in cache l'identificativo e lo ritorno.
            _ => { Labeler.store.set(uri, id) && resolve(id) },
            // Alla fine del processo ritorno la label
            () => { resolve(Labeler.store.get(uri) || id) }
          )
      })
    } catch (e) {
      // Se qualcosa va storta ritorno l'identificativo
      return Promise.resolve(id)
    }
  }

  /**
   * Permette di definire dei valori custom per le label di determinate risorse.
   * Non fa altro che salvare in cache i valori presenti in obj.
   *
   * @param obj Oggetto in cui le chiavi sono le URI delle risorse e i valori le label da associare
   */
  public static prepopulate (obj: Record<URI, string>): void {
    forEachObjIndexed((value: string, key: URI) => {
      Labeler.store.set(key, value)
    }, obj)
  }

  /**
   * Si occupa di caricare in cache le label provenienti dalle ontologie passate come parametro, così da risparmiare
   * tempo per le chiamate successive
   * @param urls array di indirizzi a ontologie da cui estrapolare le label
   * @param lang lingua di definizione della label
   * @param proxy eventualmente il proxy da utilizzare per fare le chiamate
   */
  public static async prefetch (urls: URI[], lang: string = '', proxy: string = ''): Promise<void> {
    await pipe(
      map((url: URI) => Labeler.__(url, lang, proxy)),
      urlsPromise => Promise.all(urlsPromise)
    )(urls)
  }

  /**
   * Scorciatoia che cerca le label per un insieme di risorse
   * @param urls lista di risorse per cui ricavare la label
   * @param lang lingua di definizione della label
   * @param proxy eventualmente il proxy da utilizzare per fare le chiamate
   * @return La promise contenente la lista di label associate alle risorse cercate
   */
  public static async all (urls: URI[], lang: string = '', proxy: string = ''): Promise<string[]> {
    return await pipe(
      map((url: URI) => Labeler.__(url, lang, proxy)),
      urlsPromise => Promise.all(urlsPromise)
    )(urls)
  }

  /**
   * Svuota la cache
   */
  public static flush () {
    Labeler.store.clear()
  }
}

// Export all Labeler method as function
/**
 * Ricerca la label associata alla risorsa LOD e la ritorna.
 *
 * @param {URI} uri URI della risorsa LOD di cui cercare la label
 * @param {string} [proxy] qual'ora la ricerca necessiti di un proxy per la ricerca
 * @return {Promise<string>} Ritorna una Promise contenente la label associata alla risorsa
 */
export const __: (uri: URI, label?: string, proxy?: string) => Promise<string> = Labeler.__
/**
 * Si occupa di caricare in cache le label provenienti dalle ontologie passate come parametro, così da risparmiare
 * tempo per le chiamate successive
 * @param urls array di indirizzi a ontologie da cui estrapolare le label
 * @param proxy eventualmente il proxy da utilizzare per fare le chiamate
 */
export const prefetch: (urls: URI[], lang?: string, proxy?: string) => Promise<void> = Labeler.prefetch
/**
 * Permette di definire dei valori custom per le label di determinate risorse.
 * Non fa altro che salvare in cache i valori presenti in obj.
 *
 * @param obj Oggetto in cui le chiavi sono le URI delle risorse e i valori le label da associare
 */
export const prepopulate: (obj: Record<URI, string>) => void = Labeler.prepopulate
/**
 * Scorciatoia che cerca le label per un insieme di risorse
 * @param urls lista di risorse per cui ricavare la label
 * @param proxy eventualmente il proxy da utilizzare per fare le chiamate
 * @return La promise contenente la lista di label associate alle risorse cercate
 */
export const __all: (urls: URI[], lang?: string, proxy?: string) => Promise<string[]> = Labeler.all
