import type { FC } from 'react'
import React from 'react'
import { PencilSquareIcon } from '@heroicons/react/24/solid'
import { useTranslation } from 'react-i18next'
export interface IHeaderProps {
  title: string
  onRestart?: () => void
}
const Header: FC<IHeaderProps> = ({
  title,
  onRestart,
}) => {
  const { t } = useTranslation()
  return (
    <div className="shrink-0 relative flex items-center justify-center h-12 px-3 bg-gray-100">
      <div className='flex items-center space-x-2'>
        <img src='/gextor-ia.svg' alt={title} className='h-8 w-8 rounded-lg' />
        <div className=" text-sm text-gray-800 font-bold">{title}</div>
      </div>
      {onRestart && (
        <div
          className='absolute right-3 flex items-center space-x-1 h-8 px-2 cursor-pointer rounded-lg hover:bg-gray-200'
          onClick={onRestart}
          title={t('app.chat.newChat') as string}
        >
          <PencilSquareIcon className="h-4 w-4 text-gray-500" />
          <span className='text-xs text-gray-500'>{t('app.chat.newChat')}</span>
        </div>
      )}
    </div>
  )
}

export default React.memo(Header)
