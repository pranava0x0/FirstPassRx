import type { PricePoint } from '../lib/cash'

/** Vendor cash-price boxes, each one a link to that vendor. The link itself doesn't depend on a
 * price snapshot existing — a vendor with no confirmed price still gets a box, just without the
 * amount/quantity lines, so the link is never lost. */
export function CashPriceBoxes({
  goodRxHref,
  goodRx,
  costPlusHref,
  costPlus,
  capturedAt,
}: {
  goodRxHref: string
  goodRx: PricePoint | null
  costPlusHref: string | null
  costPlus: PricePoint | null
  capturedAt: string | null
}) {
  return (
    <div className="price-boxes">
      <div className="price-boxes__row">
        <a className="price-box" href={goodRxHref} target="_blank" rel="noopener noreferrer">
          <span className="price-box__vendor">
            GoodRx <span className="price-box__external" aria-hidden="true">&#8599;</span>
          </span>
          {goodRx ? (
            <>
              <span className="price-box__amount">~${goodRx.price.toFixed(2)}</span>
              <span className="price-box__qty">{goodRx.quantity}</span>
            </>
          ) : null}
        </a>
        {costPlusHref ? (
          <a className="price-box" href={costPlusHref} target="_blank" rel="noopener noreferrer">
            <span className="price-box__vendor">
              Cost+ <span className="price-box__external" aria-hidden="true">&#8599;</span>
            </span>
            {costPlus ? (
              <>
                <span className="price-box__amount">~${costPlus.price.toFixed(2)}</span>
                <span className="price-box__qty">{costPlus.quantity}</span>
              </>
            ) : null}
          </a>
        ) : null}
      </div>
      {capturedAt && (goodRx || costPlus) ? (
        <p className="price-boxes__date">Prices as of {capturedAt}</p>
      ) : null}
    </div>
  )
}
